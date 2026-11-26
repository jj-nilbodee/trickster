import { describe as group, expect, it } from "vitest";
import { linkKey, signLink, verifyLink } from "../src/partylink.js";
import { ApiError, PARTY_SIZE, loadParties, partyAction, type Party, type PartyDeps, type PartyStore } from "../src/parties.js";
import type { Member, Store } from "../src/db.js";
import { handleInteraction, type Deps } from "../src/commands.js";

const key = linkKey("bot-token");
const claims = { guildId: "111", userId: "222", channelId: "333" };

class MemParties implements PartyStore {
  rows: Party[] = [];
  n = 0;
  async list(g: string) { return this.rows.filter((p) => p.guild_id === g); }
  async get(g: string, id: string) { return this.rows.find((p) => p.guild_id === g && p.id === id) ?? null; }
  async save(p: any) {
    if (p.id) { const r = (await this.get(p.guild_id, p.id))!; Object.assign(r, p); return r; }
    const r = { ...p, id: `00000000-0000-4000-8000-${String(++this.n).padStart(12, "0")}` };
    this.rows.push(r);
    return r;
  }
  async delete(g: string, id: string) { const n = this.rows.length; this.rows = this.rows.filter((p) => !(p.guild_id === g && p.id === id)); return this.rows.length < n; }
}

function setup() {
  const members: Member[] = ["a", "b", "c", "d", "e", "f", "g"].map((u, i) => ({
    guild_id: "111", user_id: u, name: "N" + u, char_id: "dragon", job: "", level: 100 + i, build: "น้ำ",
  }));
  const store = { search: async (g: string) => members.filter((m) => m.guild_id === g) } as unknown as Store;
  const posted: any[] = [];
  const discord = { createMessage: async (channel: string, message: any) => { posted.push({ channel, message }); } } as any;
  const parties = new MemParties();
  const d: PartyDeps = { store, parties, discord, linkKey: key };
  return { d, parties, posted, t: signLink(key, claims) };
}

group("party links", () => {
  it("round-trips and rejects tampering, other keys and expiry", () => {
    const t = signLink(key, claims, 1_000_000);
    expect(verifyLink(key, t, 1_000_000)).toMatchObject(claims);
    expect(verifyLink(key, t.replace("111", "112"), 1_000_000)).toBeNull();
    expect(verifyLink(linkKey("other"), t, 1_000_000)).toBeNull();
    expect(verifyLink(key, t, 1_000_000 + 25 * 3600_000)).toBeNull();
    expect(verifyLink(key, "junk", 0)).toBeNull();
    expect(verifyLink(key, null, 0)).toBeNull();
  });
});

group("party api", () => {
  it("needs a valid link", async () => {
    const { d } = setup();
    await expect(loadParties(d, "x")).rejects.toBeInstanceOf(ApiError);
    await expect(partyAction(d, { t: "x", action: "save" })).rejects.toMatchObject({ status: 401 });
  });

  it("saves parties with only registered members, max size, no duplicates", async () => {
    const { d, t } = setup();
    const party = ((await partyAction(d, { t, action: "save", party: { name: "  ToC ", members: ["a", "a", "zzz", "b", "c", "d", "e", "f", "g"] } })) as any).party as Party;
    expect(party.name).toBe("ToC");
    expect(party.members).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(party.members).toHaveLength(PARTY_SIZE);
    const loaded = await loadParties(d, t);
    expect(loaded.parties).toHaveLength(1);
    expect(loaded.members).toHaveLength(7);
    expect(loaded.me).toBe("222");
    // A link for another server sees nothing
    const other = signLink(key, { ...claims, guildId: "999" });
    expect((await loadParties(d, other)).parties).toHaveLength(0);
    await expect(partyAction(d, { t: other, action: "save", party: { id: party.id, name: "x", members: [] } })).rejects.toMatchObject({ status: 404 });
  });

  it("announces in the link's channel, pinging only members, then deletes", async () => {
    const { d, t, posted, parties } = setup();
    const party = ((await partyAction(d, { t, action: "save", party: { name: "Boss", note: "3 ทุ่ม", members: ["a", "b"] } })) as any).party as Party;
    await partyAction(d, { t, action: "announce", id: party.id });
    expect(posted[0].channel).toBe("333");
    expect(posted[0].message.allowed_mentions).toEqual({ users: ["a", "b"] });
    expect(posted[0].message.embeds[0].description).toContain("Na");
    expect(posted[0].message.embeds[0].description).toContain("ว่างอีก 4 ที่");
    expect(await partyAction(d, { t, action: "delete", id: party.id })).toEqual({ deleted: true });
    expect(parties.rows).toHaveLength(0);
  });
});

group("party button", () => {
  it("gives a personal link button", async () => {
    const d = { store: {}, discord: {}, partyUrl: (c: any) => `https://x/party?t=${c.guildId}-${c.userId}-${c.channelId}` } as unknown as Deps;
    const i = { type: 3, token: "t", application_id: "a", guild_id: "g", channel_id: "c", member: { user: { id: "u" }, roles: [] }, data: { custom_id: "panel:party" } };
    const h = await handleInteraction(i as any, d);
    const r = h.response as any;
    expect(r.data.flags).toBe(64);
    expect(r.data.components[0].components[0]).toMatchObject({ style: 5, url: "https://x/party?t=g-u-c" });
  });
});
