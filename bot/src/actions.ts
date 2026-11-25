// What the bot does, shared by slash commands (commands.ts) and the button panel (panel.ts).
import { CHARACTERS, MANAGED_ROLE_NAMES, MAX_LEVEL, STAT_COLOUR, STAT_EMOJI } from "./jobs.js";
import { NameTaken, type Member, type Store } from "./db.js";
import { DiscordError, EPHEMERAL, ResponseType, type DiscordApi } from "./discord.js";

export interface Deps {
  store: Store;
  discord: DiscordApi;
}

export interface Handled {
  /** Sent straight back to Discord (must be within 3 seconds). */
  response: object;
  /** Slow work done after responding; it edits the deferred reply when finished. */
  after?: () => Promise<void>;
}

export interface GuildMember {
  user?: { id: string };
  nick?: string | null;
  roles: string[];
  permissions?: string;
}

export interface Interaction {
  type: number;
  token: string;
  application_id: string;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMember;
  data?: {
    name?: string;
    custom_id?: string;
    values?: string[];
    options?: { name: string; value: string | number | boolean; focused?: boolean }[];
    resolved?: { members?: Record<string, GuildMember> };
    components?: { components: { custom_id: string; value: string }[] }[];
  };
}

export interface Reply {
  content: string;
  embeds?: object[];
}

export const msg = (content: string, ephemeral = true) => ({
  type: ResponseType.MESSAGE,
  data: { content, flags: ephemeral ? EPHEMERAL : 0, allowed_mentions: { parse: [] } },
});

/** Respond now with "thinking…", then run `work` and put its result in the reply. */
export function deferred(
  i: Interaction,
  d: Deps,
  work: () => Promise<Reply>,
  opts: { ephemeral?: boolean; update?: boolean } = {},
): Handled {
  const edit = (r: Reply) =>
    d.discord.editReply(i.application_id, i.token, {
      content: r.content,
      embeds: r.embeds ?? [],
      components: [],
      allowed_mentions: { parse: [] },
    });
  return {
    response: opts.update
      ? { type: ResponseType.DEFERRED_UPDATE }
      : { type: ResponseType.DEFERRED_MESSAGE, data: { flags: opts.ephemeral === false ? 0 : EPHEMERAL } },
    after: async () => {
      try {
        await edit(await work());
      } catch (e) {
        console.error("interaction failed", i.data?.name ?? i.data?.custom_id, e);
        await edit({ content: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }).catch(() => {});
      }
    },
  };
}

export function describe(m: Member): string {
  const c = CHARACTERS[m.char_id];
  return `${STAT_EMOJI[c.stat]} **${m.name}** · ${c.name} · Lv.${m.level}`;
}

export function roleNameFor(m: Member): string {
  return CHARACTERS[m.char_id].name;
}

/** Rename the member and swap their character role. Returns warnings for anything that failed. */
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

  const want = roleNameFor(m);
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
    warnings.push(`ให้ role ${want} ไม่ได้ ต้องลาก role ของบอทให้อยู่สูงกว่า role ตัวละครใน Server Settings > Roles`);
  }
  return warnings;
}

export async function registerAction(
  d: Deps,
  guildId: string,
  me: GuildMember,
  input: { name: string; charId: string; level: number },
): Promise<Reply> {
  const userId = me.user!.id;
  const name = input.name.trim();
  let m: Member;
  try {
    m = await d.store.upsert({
      guild_id: guildId,
      user_id: userId,
      name,
      char_id: input.charId,
      job: "", // jobs are no longer asked for; column kept for old rows and a possible return
      level: input.level,
    });
  } catch (e) {
    if (!(e instanceof NameTaken)) throw e;
    const who = e.ownerId === "?" ? "คนอื่น" : `<@${e.ownerId}>`;
    return { content: `ชื่อ **${name}** มีคนลงทะเบียนไว้แล้ว (${who})` };
  }
  const warnings = await applyRoleAndNick(d, guildId, userId, me, m);
  return { content: `ลงทะเบียนแล้ว ✅\n${describe(m)}` + warnings.map((w) => `\n⚠️ ${w}`).join("") };
}

export async function levelAction(d: Deps, guildId: string, userId: string, level: number): Promise<Reply> {
  const m = await d.store.setLevel(guildId, userId, level);
  return { content: m ? `อัปเดตแล้ว ✅\n${describe(m)}` : "ยังไม่ได้ลงทะเบียน กดปุ่มลงทะเบียนหรือใช้ /register ก่อน" };
}

export async function profileAction(d: Deps, guildId: string, userId: string, target: string): Promise<Reply> {
  const m = await d.store.get(guildId, target);
  if (!m) return { content: `${target === userId ? "คุณ" : `<@${target}>`} ยังไม่ได้ลงทะเบียน` };
  return { content: `${describe(m)}\n<@${m.user_id}>` };
}

export async function rosterAction(d: Deps, guildId: string): Promise<Reply> {
  const members = await d.store.search(guildId);
  const fields = Object.entries(CHARACTERS).flatMap(([id, c]) => {
    const ms = members.filter((m) => m.char_id === id);
    if (!ms.length) return [];
    let value = ms.map((m) => `${m.name} · Lv.${m.level}`).join("\n");
    if (value.length > 1024) value = value.slice(0, 1000).replace(/\n[^\n]*$/, "") + "\n…";
    return [{ name: `${STAT_EMOJI[c.stat]} ${c.name} (${ms.length})`, value, inline: true }];
  });
  return {
    content: "",
    embeds: [
      {
        title: "สมาชิกกิลด์",
        color: 0xf1c40f,
        description: members.length ? undefined : "ยังไม่มีใครลงทะเบียน",
        fields,
        footer: { text: `ทั้งหมด ${members.length} คน` },
      },
    ],
  };
}

export async function unregisterAction(
  d: Deps,
  guildId: string,
  target: string,
  targetMember: GuildMember | undefined,
): Promise<Reply> {
  if (!(await d.store.delete(guildId, target))) return { content: "ไม่มีข้อมูลให้ลบ" };
  try {
    const guild = await d.discord.getGuild(guildId);
    const managed = new Set(guild.roles.filter((r) => MANAGED_ROLE_NAMES.has(r.name)).map((r) => r.id));
    for (const id of targetMember?.roles ?? []) if (managed.has(id)) await d.discord.removeRole(guildId, target, id);
    if (guild.owner_id !== target) await d.discord.setNick(guildId, target, null);
  } catch (e) {
    if (!(e instanceof DiscordError) || e.status !== 403) throw e;
  }
  return { content: `ลบข้อมูลของ <@${target}> แล้ว` };
}
