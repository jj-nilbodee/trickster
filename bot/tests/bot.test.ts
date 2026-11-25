import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe as group, expect, it, vi } from "vitest";
import { applyRoleAndNick, handleInteraction, COMMANDS, type Deps } from "../src/commands.js";
import { NameTaken, type Filters, type Member, type Store } from "../src/db.js";
import { DiscordError, EPHEMERAL, verifySignature, type DiscordApi, type Role } from "../src/discord.js";
import { CHARACTERS, findJob } from "../src/jobs.js";

class MemoryStore implements Store {
  rows: Member[] = [];
  async get(g: string, u: string) {
    return this.rows.find((r) => r.guild_id === g && r.user_id === u) ?? null;
  }
  async upsert(m: Member) {
    const other = this.rows.find((r) => r.guild_id === m.guild_id && r.name.toLowerCase() === m.name.toLowerCase() && r.user_id !== m.user_id);
    if (other) throw new NameTaken(other.user_id);
    this.rows = this.rows.filter((r) => !(r.guild_id === m.guild_id && r.user_id === m.user_id));
    this.rows.push({ ...m });
    return m;
  }
  async setLevel(g: string, u: string, level: number) {
    const r = await this.get(g, u);
    if (r) r.level = level;
    return r;
  }
  async delete(g: string, u: string) {
    const n = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.guild_id === g && r.user_id === u));
    return this.rows.length < n;
  }
  async search(g: string, f: Filters = {}) {
    return this.rows
      .filter((r) => r.guild_id === g)
      .filter((r) => !f.charId || r.char_id === f.charId)
      .filter((r) => !f.job || r.job.toLowerCase() === f.job.toLowerCase())
      .filter((r) => f.minLevel == null || r.level >= f.minLevel)
      .filter((r) => f.maxLevel == null || r.level <= f.maxLevel)
      .sort((a, b) => b.level - a.level);
  }
}

class FakeDiscord implements DiscordApi {
  roles: Role[] = [{ id: "r-bunny", name: "Bunny" }, { id: "r-admin", name: "Admin" }];
  ownerId = "owner";
  nicks: Record<string, string | null> = {};
  memberRoles: Record<string, string[]> = {};
  replies: any[] = [];
  forbidNick = false;
  async getGuild() {
    return { owner_id: this.ownerId, roles: [...this.roles] };
  }
  async createRole(_g: string, name: string) {
    const r = { id: "r-" + name.toLowerCase(), name };
    this.roles.push(r);
    return r;
  }
  async setNick(_g: string, u: string, nick: string | null) {
    if (this.forbidNick) throw new DiscordError(403, "Missing Permissions");
    this.nicks[u] = nick;
  }
  async addRole(_g: string, u: string, id: string) {
    (this.memberRoles[u] ??= []).push(id);
  }
  async removeRole(_g: string, u: string, id: string) {
    this.memberRoles[u] = (this.memberRoles[u] ?? []).filter((r) => r !== id);
  }
  async editReply(_a: string, _t: string, message: object) {
    this.replies.push(message);
  }
  posted: { channel: string; message: any }[] = [];
  async createMessage(channel: string, message: object) {
    this.posted.push({ channel, message });
  }
}

function setup(roleMode: Deps["roleMode"] = "character") {
  const store = new MemoryStore();
  const discord = new FakeDiscord();
  return { store, discord, deps: { store, discord, roleMode } as Deps };
}

function command(name: string, options: Record<string, unknown>, user = "u1", member: object = {}) {
  return {
    type: 2,
    token: "tok",
    application_id: "app",
    guild_id: "g1",
    member: { user: { id: user }, nick: null, roles: [] as string[], permissions: "0", ...member },
    data: { name, options: Object.entries(options).map(([name, value]) => ({ name, value })) },
  };
}

async function run(deps: Deps, i: any) {
  const h = await handleInteraction(i, deps);
  await h.after?.();
  return h;
}

group("job data", () => {
  it("matches the guide site's job files", () => {
    const dir = new URL("../../docs/data/jobs/", import.meta.url);
    for (const f of readdirSync(dir)) {
      const d = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
      expect(CHARACTERS[d.id]).toBeDefined();
      for (const job of CHARACTERS[d.id].jobs) expect(d.path).toContain(job);
    }
    expect(findJob("dragon", "priest")).toBe("Priest");
    expect(findJob("dragon", "Boxer")).toBeUndefined();
  });

  it("command definitions fit Discord limits", () => {
    for (const c of COMMANDS) {
      expect(c.name).toMatch(/^[a-z_]{1,32}$/);
      expect(c.description.length).toBeLessThanOrEqual(100);
      for (const o of (c as any).options ?? []) expect(o.description.length).toBeLessThanOrEqual(100);
    }
  });
});

group("signature", () => {
  it("accepts Discord-signed requests and rejects others", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const pubHex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
    const body = '{"type":1}';
    const ts = "1700000000";
    const sig = sign(null, Buffer.from(ts + body), privateKey).toString("hex");
    expect(await verifySignature(pubHex, sig, ts, body)).toBe(true);
    expect(await verifySignature(pubHex, sig, ts, body + " ")).toBe(false);
    expect(await verifySignature(pubHex, null, ts, body)).toBe(false);
    expect(await verifySignature(pubHex, "zz", ts, body)).toBe(false);
  });
});

group("commands", () => {
  it("answers Discord's ping", async () => {
    const { deps } = setup();
    expect((await handleInteraction({ type: 1 } as any, deps)).response).toEqual({ type: 1 });
  });

  it("/register saves, renames and swaps the job role", async () => {
    const { deps, store, discord } = setup();
    const h = await run(deps, command("register", { name: "Mingo", character: "dragon", job: "priest", level: 150 }, "u1", { roles: ["r-bunny", "r-admin"] }));
    expect(h.response).toEqual({ type: 5, data: { flags: EPHEMERAL } });
    expect(store.rows[0]).toMatchObject({ name: "Mingo", char_id: "dragon", job: "Priest", level: 150 });
    expect(discord.nicks.u1).toBe("Mingo");
    expect(discord.roles.map((r) => r.name)).toContain("Dragon");
    expect(discord.replies[0].content).toContain("ลงทะเบียนแล้ว");
  });

  it("removes old job roles and keeps other roles", async () => {
    const { deps, discord } = setup();
    discord.memberRoles.u1 = ["r-bunny", "r-admin"];
    const m: Member = { guild_id: "g1", user_id: "u1", name: "Mingo", char_id: "dragon", job: "Priest", level: 150 };
    const warnings = await applyRoleAndNick(deps, "g1", "u1", { roles: ["r-bunny", "r-admin"], nick: null }, m);
    expect(warnings).toEqual([]);
    expect(discord.memberRoles.u1.sort()).toEqual(["r-admin", "r-dragon"]);
  });

  it("job role mode uses the job name", async () => {
    const { deps, discord } = setup("job");
    await run(deps, command("register", { name: "Mingo", character: "dragon", job: "Dark Lord", level: 150 }));
    expect(discord.memberRoles.u1).toEqual(["r-dark lord"]);
  });

  it("warns instead of failing when it cannot rename", async () => {
    const { deps, discord } = setup();
    await run(deps, command("register", { name: "Boss", character: "fox", job: "Explorer", level: 99 }, "owner"));
    expect(discord.replies[0].content).toContain("เจ้าของเซิร์ฟเวอร์");
    discord.forbidNick = true;
    await run(deps, command("register", { name: "Sppo", character: "bunny", job: "Boxer", level: 99 }, "u2"));
    expect(discord.replies[1].content).toContain("Manage Nicknames");
  });

  it("rejects a wrong job and a taken name", async () => {
    const { deps, store, discord } = setup();
    const bad = await handleInteraction(command("register", { name: "X", character: "dragon", job: "Boxer", level: 1 }) as any, deps);
    expect((bad.response as any).data.content).toContain("ไม่มีอาชีพ");
    await run(deps, command("register", { name: "Mingo", character: "dragon", job: "Priest", level: 1 }, "u1"));
    await run(deps, command("register", { name: "mingo", character: "fox", job: "Explorer", level: 1 }, "u2"));
    expect(discord.replies[1].content).toContain("มีคนลงทะเบียนไว้แล้ว");
    expect(store.rows).toHaveLength(1);
  });

  it("/party filters and /level updates", async () => {
    const { deps, discord } = setup();
    await run(deps, command("register", { name: "Mingo", character: "dragon", job: "Priest", level: 150 }, "u1"));
    await run(deps, command("register", { name: "Sppo", character: "bunny", job: "Champion", level: 120 }, "u2"));
    await run(deps, command("level", { level: 130 }, "u2"));
    discord.replies = [];
    const h = await run(deps, command("party", { min_level: 100, max_level: 140, show_all: true }));
    expect(h.response).toEqual({ type: 5, data: { flags: 0 } });
    const embed = discord.replies[0].embeds[0];
    expect(embed.description).toContain("Sppo");
    expect(embed.description).not.toContain("Mingo");
    expect(embed.description).toContain("Lv.130");
    await run(deps, command("roster", {}));
    expect(discord.replies[1].embeds[0].fields).toHaveLength(2);
  });

  it("/unregister: only admins can remove others", async () => {
    const { deps, store, discord } = setup();
    await run(deps, command("register", { name: "Mingo", character: "dragon", job: "Priest", level: 150 }, "u1"));
    const denied = await handleInteraction(command("unregister", { member: "u1" }, "u2") as any, deps);
    expect((denied.response as any).data.content).toContain("เฉพาะแอดมิน");
    const admin = command("unregister", { member: "u1" }, "u2", { permissions: String(1n << 27n) }) as any;
    admin.data.resolved = { members: { u1: { roles: ["r-dragon"] } } };
    await run(deps, admin);
    expect(store.rows).toHaveLength(0);
    expect(discord.nicks.u1).toBeNull();
  });

  it("job autocomplete follows the chosen character", async () => {
    const { deps } = setup();
    const h = await handleInteraction(
      { type: 4, data: { name: "register", options: [{ name: "character", value: "dragon" }, { name: "job", value: "A", focused: true }] } } as any,
      deps,
    );
    expect((h.response as any).data.choices.map((c: any) => c.value)).toEqual(["Shaman", "Magician", "Dark Lord", "Wizard"]);
  });
});

function component(custom_id: string, values?: string[], user = "u1", member: object = {}) {
  return {
    type: 3,
    token: "tok",
    application_id: "app",
    guild_id: "g1",
    member: { user: { id: user }, nick: null, roles: [] as string[], ...member },
    data: { custom_id, values },
  };
}

function modal(custom_id: string, fields: Record<string, string>, user = "u1") {
  return {
    type: 5,
    token: "tok",
    application_id: "app",
    guild_id: "g1",
    member: { user: { id: user }, nick: null, roles: [] as string[] },
    data: { custom_id, components: Object.entries(fields).map(([custom_id, value]) => ({ components: [{ custom_id, value }] })) },
  };
}

group("button panel", () => {
  it("/panel posts a message with buttons in the channel", async () => {
    const { deps, discord } = setup();
    await run(deps, { ...command("panel", {}), channel_id: "c1" });
    expect(discord.posted[0].channel).toBe("c1");
    const ids = discord.posted[0].message.components.flatMap((r: any) => r.components.map((b: any) => b.custom_id));
    expect(ids).toEqual(["panel:register", "panel:level", "panel:profile", "panel:party", "panel:roster"]);
    expect(COMMANDS.find((c) => c.name === "panel")).toMatchObject({ default_member_permissions: "32" });
  });

  it("register: character menu > job menu > form > saved", async () => {
    const { deps, store, discord } = setup();
    const step1: any = (await handleInteraction(component("panel:register") as any, deps)).response;
    expect(step1.data.flags).toBe(EPHEMERAL);
    expect(step1.data.components[0].components[0].options).toHaveLength(9);

    const step2: any = (await handleInteraction(component("reg:char", ["dragon"]) as any, deps)).response;
    expect(step2.type).toBe(7);
    expect(step2.data.components[0].components[0].options.map((o: any) => o.value)).toContain("Priest");

    const step3: any = (await handleInteraction(component("reg:job:dragon", ["Dark Lord"]) as any, deps)).response;
    expect(step3.type).toBe(9);
    expect(step3.data.custom_id).toBe("modal:reg:dragon:Dark Lord");

    const done = await run(deps, modal("modal:reg:dragon:Dark Lord", { name: " Mingo ", level: "150" }));
    expect(done.response).toEqual({ type: 6 });
    expect(store.rows[0]).toMatchObject({ name: "Mingo", job: "Dark Lord", level: 150 });
    expect(discord.nicks.u1).toBe("Mingo");
    expect(discord.replies[0].content).toContain("ลงทะเบียนแล้ว");
    expect(discord.replies[0].components).toEqual([]);

    // Opening the form again fills in the saved name and level
    const again: any = (await handleInteraction(component("reg:job:dragon", ["Priest"]) as any, deps)).response;
    expect(again.data.components.map((r: any) => r.components[0].value)).toEqual(["Mingo", "150"]);
  });

  it("rejects a bad level in the form", async () => {
    const { deps, store } = setup();
    const h: any = await handleInteraction(modal("modal:reg:dragon:Priest", { name: "Mingo", level: "abc" }) as any, deps);
    expect(h.response.data.content).toContain("เลเวลต้องเป็นตัวเลข");
    expect(store.rows).toHaveLength(0);
  });

  it("level and party forms", async () => {
    const { deps, discord } = setup();
    await run(deps, modal("modal:reg:dragon:Priest", { name: "Mingo", level: "150" }, "u1"));
    await run(deps, modal("modal:reg:bunny:Champion", { name: "Sppo", level: "120" }, "u2"));
    await run(deps, modal("modal:level", { level: "Lv.155" }, "u1"));
    discord.replies = [];
    await run(deps, modal("modal:party", { who: "priest", min: "150", max: "" }));
    expect(discord.replies[0].embeds[0].description).toContain("Mingo");
    expect(discord.replies[0].embeds[0].description).toContain("Lv.155");
    expect(discord.replies[0].embeds[0].description).not.toContain("Sppo");
    await run(deps, modal("modal:party", { who: "bunny", min: "", max: "" }));
    expect(discord.replies[1].embeds[0].description).toContain("Sppo");
    const bad: any = await handleInteraction(modal("modal:party", { who: "pikachu", min: "", max: "" }) as any, deps);
    expect(bad.response.data.content).toContain("ไม่รู้จัก");
  });

  it("profile and roster buttons", async () => {
    const { deps, discord } = setup();
    await run(deps, component("panel:profile"));
    expect(discord.replies[0].content).toContain("ยังไม่ได้ลงทะเบียน");
    await run(deps, component("panel:roster"));
    expect(discord.replies[1].embeds[0].description).toContain("ยังไม่มีใคร");
  });
});

group("Vercel endpoint", () => {
  it("rejects unsigned requests", async () => {
    process.env.DISCORD_PUBLIC_KEY = "00".repeat(32);
    const { POST } = await import("../api/interactions.js");
    const res = await POST(new Request("https://x/api/interactions", { method: "POST", body: '{"type":1}' }));
    expect(res.status).toBe(401);
  });
});
