import { CHARACTERS, MANAGED_ROLE_NAMES, MAX_LEVEL, STAT_COLOUR, STAT_EMOJI, allJobs, findJob } from "./jobs.js";
import { NameTaken, type Member, type Store } from "./db.js";
import {
  DiscordError,
  EPHEMERAL,
  InteractionType,
  ResponseType,
  hasManageNicknames,
  type DiscordApi,
} from "./discord.js";

// ---------- Command definitions (sent to Discord by scripts/register-commands.ts) ----------

const STRING = 3,
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6;

const characterOption = (required: boolean) => ({
  type: STRING,
  name: "character",
  description: "ตัวละคร",
  required,
  choices: Object.entries(CHARACTERS).map(([id, c]) => ({ name: `${c.name} (${c.stat})`, value: id })),
});
const jobOption = (required: boolean) => ({
  type: STRING,
  name: "job",
  description: required ? "อาชีพตอนนี้" : "อาชีพ",
  required,
  autocomplete: true,
});
const levelOption = (name: string, description: string, required: boolean) => ({
  type: INTEGER,
  name,
  description,
  required,
  min_value: 1,
  max_value: MAX_LEVEL,
});

const GUILD_ONLY = { contexts: [0], dm_permission: false };

export const COMMANDS = [
  {
    name: "register",
    description: "ลงทะเบียนตัวละคร บอทจะเปลี่ยนชื่อในเซิร์ฟเวอร์และให้ role อาชีพ",
    ...GUILD_ONLY,
    options: [
      { type: STRING, name: "name", description: "ชื่อตัวละครในเกม", required: true, min_length: 1, max_length: 32 },
      characterOption(true),
      jobOption(true),
      levelOption("level", "เลเวลตอนนี้", true),
    ],
  },
  {
    name: "level",
    description: "อัปเดตเลเวลตัวละครที่ลงทะเบียนไว้",
    ...GUILD_ONLY,
    options: [levelOption("level", "เลเวลใหม่", true)],
  },
  {
    name: "profile",
    description: "ดูตัวละครที่ลงทะเบียนไว้",
    ...GUILD_ONLY,
    options: [{ type: USER, name: "member", description: "สมาชิกที่อยากดู (ว่างไว้ = ตัวเอง)", required: false }],
  },
  {
    name: "party",
    description: "หาสมาชิกสำหรับจัดปาร์ตี้ ตามตัวละคร อาชีพ หรือช่วงเลเวล",
    ...GUILD_ONLY,
    options: [
      characterOption(false),
      jobOption(false),
      levelOption("min_level", "เลเวลต่ำสุด", false),
      levelOption("max_level", "เลเวลสูงสุด", false),
      { type: BOOLEAN, name: "show_all", description: "ให้ทุกคนในห้องเห็นผลลัพธ์ (ค่าเริ่มต้น: เห็นคนเดียว)", required: false },
    ],
  },
  {
    name: "roster",
    description: "รายชื่อตัวละครทั้งหมดในกิลด์ แยกตามตัวละคร",
    ...GUILD_ONLY,
  },
  {
    name: "unregister",
    description: "ลบข้อมูลตัวละคร (แอดมินลบของคนอื่นได้)",
    ...GUILD_ONLY,
    options: [
      {
        type: USER,
        name: "member",
        description: "สมาชิกที่จะลบ (ว่างไว้ = ตัวเอง ต้องมีสิทธิ์ Manage Nicknames ถึงลบของคนอื่นได้)",
        required: false,
      },
    ],
  },
];

// ---------- Handling ----------

export interface Deps {
  store: Store;
  discord: DiscordApi;
  /** "character" = role per character (Dragon, Fox, ...); "job" = role per job (Priest, Dark Lord, ...) */
  roleMode: "character" | "job";
}

export interface Handled {
  /** Sent straight back to Discord (must be within 3 seconds). */
  response: object;
  /** Slow work done after responding; it edits the deferred reply when finished. */
  after?: () => Promise<void>;
}

interface GuildMember {
  user?: { id: string };
  nick?: string | null;
  roles: string[];
  permissions?: string;
}

interface Interaction {
  type: number;
  token: string;
  application_id: string;
  guild_id?: string;
  member?: GuildMember;
  data?: {
    name: string;
    options?: { name: string; value: string | number | boolean; focused?: boolean }[];
    resolved?: { members?: Record<string, GuildMember> };
  };
}

const msg = (content: string, ephemeral = true) => ({
  type: ResponseType.MESSAGE,
  data: { content, flags: ephemeral ? EPHEMERAL : 0, allowed_mentions: { parse: [] } },
});

export function describe(m: Member): string {
  const c = CHARACTERS[m.char_id];
  return `${STAT_EMOJI[c.stat]} **${m.name}** · ${c.name} ${m.job} · Lv.${m.level}`;
}

export function roleNameFor(m: Member, mode: Deps["roleMode"]): string {
  return mode === "job" ? m.job : CHARACTERS[m.char_id].name;
}

/** Rename the member and swap their job role. Returns warnings for anything that failed. */
export async function applyRoleAndNick(
  d: Deps,
  guildId: string,
  userId: string,
  current: GuildMember,
  m: Member,
): Promise<string[]> {
  const warnings: string[] = [];
  const guild = await d.discord.getGuild(guildId);

  if (current.nick !== m.name) {
    if (guild.owner_id === userId) {
      warnings.push("เปลี่ยนชื่อเจ้าของเซิร์ฟเวอร์ไม่ได้ (Discord ไม่อนุญาต) ต้องเปลี่ยนชื่อเอง");
    } else {
      try {
        await d.discord.setNick(guildId, userId, m.name);
      } catch (e) {
        if (!(e instanceof DiscordError) || e.status !== 403) throw e;
        warnings.push("เปลี่ยนชื่อไม่ได้ บอทต้องมีสิทธิ์ Manage Nicknames และ role ของบอทต้องอยู่สูงกว่า role ของสมาชิก");
      }
    }
  }

  const want = roleNameFor(m, d.roleMode);
  let role = guild.roles.find((r) => r.name === want);
  if (!role) {
    try {
      role = await d.discord.createRole(guildId, want, STAT_COLOUR[CHARACTERS[m.char_id].stat]);
    } catch (e) {
      if (!(e instanceof DiscordError) || e.status !== 403) throw e;
      warnings.push(`สร้าง role ${want} ไม่ได้ บอทต้องมีสิทธิ์ Manage Roles`);
    }
  }

  const byId = new Map(guild.roles.map((r) => [r.id, r]));
  const old = current.roles.filter((id) => MANAGED_ROLE_NAMES.has(byId.get(id)?.name ?? "") && id !== role?.id);
  try {
    for (const id of old) await d.discord.removeRole(guildId, userId, id);
    if (role && !current.roles.includes(role.id)) await d.discord.addRole(guildId, userId, role.id);
  } catch (e) {
    if (!(e instanceof DiscordError) || e.status !== 403) throw e;
    warnings.push(`ให้ role ${want} ไม่ได้ ต้องลาก role ของบอทให้อยู่สูงกว่า role อาชีพใน Server Settings > Roles`);
  }
  return warnings;
}

function memberListEmbed(title: string, members: Member[]) {
  if (!members.length) return { title, color: 0xf1c40f, description: "ไม่พบสมาชิกที่ตรงเงื่อนไข" };
  let text = "";
  let shown = 0;
  for (const m of members) {
    const line = `${describe(m)} <@${m.user_id}>\n`;
    if (text.length + line.length > 3900) break;
    text += line;
    shown++;
  }
  if (shown < members.length) text += `…และอีก ${members.length - shown} คน`;
  return { title, color: 0xf1c40f, description: text, footer: { text: `ทั้งหมด ${members.length} คน` } };
}

function rosterEmbed(members: Member[]) {
  const fields = Object.entries(CHARACTERS).flatMap(([id, c]) => {
    const ms = members.filter((m) => m.char_id === id);
    if (!ms.length) return [];
    let value = ms.map((m) => `${m.name} · ${m.job} · Lv.${m.level}`).join("\n");
    if (value.length > 1024) value = value.slice(0, 1000).replace(/\n[^\n]*$/, "") + "\n…";
    return [{ name: `${STAT_EMOJI[c.stat]} ${c.name} (${ms.length})`, value, inline: true }];
  });
  return {
    title: "สมาชิกกิลด์",
    color: 0xf1c40f,
    description: members.length ? undefined : "ยังไม่มีใครลงทะเบียน",
    fields,
    footer: { text: `ทั้งหมด ${members.length} คน` },
  };
}

function autocomplete(i: Interaction): Handled {
  const opts = i.data?.options ?? [];
  const charId = opts.find((o) => o.name === "character")?.value as string | undefined;
  const current = String(opts.find((o) => o.focused)?.value ?? "").toLowerCase();
  const pairs: [string, string][] =
    charId && CHARACTERS[charId] ? CHARACTERS[charId].jobs.map((j) => [charId, j]) : allJobs();
  const choices = pairs
    .map(([cid, job]) => ({ name: charId ? job : `${job} (${CHARACTERS[cid].name})`, value: job }))
    .filter((c) => c.name.toLowerCase().includes(current))
    .slice(0, 25);
  return { response: { type: ResponseType.AUTOCOMPLETE_RESULT, data: { choices } } };
}

export async function handleInteraction(i: Interaction, d: Deps): Promise<Handled> {
  if (i.type === InteractionType.PING) return { response: { type: ResponseType.PONG } };
  if (i.type === InteractionType.AUTOCOMPLETE) return autocomplete(i);
  if (i.type !== InteractionType.APPLICATION_COMMAND || !i.data) return { response: msg("ไม่รู้จักคำสั่งนี้") };
  if (!i.guild_id || !i.member?.user) return { response: msg("ใช้คำสั่งนี้ได้ในเซิร์ฟเวอร์เท่านั้น") };

  const guildId = i.guild_id;
  const me = i.member;
  const userId = me.user!.id;
  const opt = <T>(name: string) => i.data!.options?.find((o) => o.name === name)?.value as T | undefined;
  const cmd = i.data.name;
  const ephemeral = !(cmd === "party" && opt<boolean>("show_all"));

  // Quick checks that need no database: answer immediately
  if (cmd === "register") {
    const charId = opt<string>("character")!;
    const job = opt<string>("job")!;
    if (!findJob(charId, job)) {
      return { response: msg(`${CHARACTERS[charId].name} ไม่มีอาชีพ **${job}** เลือกได้: ${CHARACTERS[charId].jobs.join(", ")}`) };
    }
  }
  if (cmd === "unregister") {
    const target = opt<string>("member");
    if (target && target !== userId && !hasManageNicknames(me.permissions)) {
      return { response: msg("ลบข้อมูลของคนอื่นได้เฉพาะแอดมิน") };
    }
  }

  const reply = (content: string, embeds?: object[]) =>
    d.discord.editReply(i.application_id, i.token, { content, embeds: embeds ?? [], allowed_mentions: { parse: [] } });

  const work = async () => {
    switch (cmd) {
      case "register": {
        const charId = opt<string>("character")!;
        const name = opt<string>("name")!.trim();
        let m: Member;
        try {
          m = await d.store.upsert({
            guild_id: guildId,
            user_id: userId,
            name,
            char_id: charId,
            job: findJob(charId, opt<string>("job")!)!,
            level: opt<number>("level")!,
          });
        } catch (e) {
          if (!(e instanceof NameTaken)) throw e;
          const who = e.ownerId === "?" ? "คนอื่น" : `<@${e.ownerId}>`;
          return reply(`ชื่อ **${name}** มีคนลงทะเบียนไว้แล้ว (${who})`);
        }
        const warnings = await applyRoleAndNick(d, guildId, userId, me, m);
        return reply(`ลงทะเบียนแล้ว ✅\n${describe(m)}` + warnings.map((w) => `\n⚠️ ${w}`).join(""));
      }
      case "level": {
        const m = await d.store.setLevel(guildId, userId, opt<number>("level")!);
        return reply(m ? `อัปเดตแล้ว ✅\n${describe(m)}` : "ยังไม่ได้ลงทะเบียน ใช้ /register ก่อน");
      }
      case "profile": {
        const target = opt<string>("member") ?? userId;
        const m = await d.store.get(guildId, target);
        if (!m) return reply(`${target === userId ? "คุณ" : `<@${target}>`} ยังไม่ได้ลงทะเบียน`);
        return reply(`${describe(m)}\n<@${m.user_id}>`);
      }
      case "party": {
        const charId = opt<string>("character");
        const job = opt<string>("job");
        const minLevel = opt<number>("min_level");
        const maxLevel = opt<number>("max_level");
        const found = await d.store.search(guildId, { charId, job, minLevel, maxLevel });
        const parts = [
          charId && CHARACTERS[charId]?.name,
          job,
          minLevel || maxLevel ? `Lv.${minLevel ?? 1}–${maxLevel ?? MAX_LEVEL}` : undefined,
        ].filter(Boolean);
        return reply("", [memberListEmbed("หาปาร์ตี้" + (parts.length ? `: ${parts.join(" · ")}` : ""), found)]);
      }
      case "roster":
        return reply("", [rosterEmbed(await d.store.search(guildId))]);
      case "unregister": {
        const target = opt<string>("member") ?? userId;
        const targetMember = target === userId ? me : i.data!.resolved?.members?.[target];
        if (!(await d.store.delete(guildId, target))) return reply("ไม่มีข้อมูลให้ลบ");
        try {
          const guild = await d.discord.getGuild(guildId);
          const managed = new Set(guild.roles.filter((r) => MANAGED_ROLE_NAMES.has(r.name)).map((r) => r.id));
          for (const id of targetMember?.roles ?? []) if (managed.has(id)) await d.discord.removeRole(guildId, target, id);
          if (guild.owner_id !== target) await d.discord.setNick(guildId, target, null);
        } catch (e) {
          if (!(e instanceof DiscordError) || e.status !== 403) throw e;
        }
        return reply(`ลบข้อมูลของ <@${target}> แล้ว`);
      }
      default:
        return reply("ไม่รู้จักคำสั่งนี้");
    }
  };

  return {
    response: { type: ResponseType.DEFERRED_MESSAGE, data: { flags: ephemeral ? EPHEMERAL : 0 } },
    after: async () => {
      try {
        await work();
      } catch (e) {
        console.error(`/${cmd} failed`, e);
        await reply("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง").catch(() => {});
      }
    },
  };
}
