// Parties made on the party web page (public/party.html), and the API behind it (api/party.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHARACTERS, STAT_EMOJI } from "./jobs.js";
import type { Member, Store } from "./db.js";
import type { DiscordApi } from "./discord.js";
import { verifyLink, type LinkClaims } from "./partylink.js";

/** Trickster parties hold up to 6 characters. */
export const PARTY_SIZE = 6;
export const MAX_PARTIES = 40;

export interface Party {
  id: string;
  guild_id: string;
  name: string;
  /** Free text: when and where, e.g. "ToC 3 ทุ่ม" */
  note: string;
  /** Discord user ids of registered members, in slot order. */
  members: string[];
  updated_at?: string;
}

export interface PartyStore {
  list(guildId: string): Promise<Party[]>;
  get(guildId: string, id: string): Promise<Party | null>;
  /** Insert when id is empty, otherwise update that party. */
  save(p: Omit<Party, "id"> & { id?: string }): Promise<Party>;
  delete(guildId: string, id: string): Promise<boolean>;
}

const COLS = "id,guild_id,name,note,members,updated_at";

export class SupabasePartyStore implements PartyStore {
  private sb: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async list(guildId: string) {
    const { data, error } = await this.sb.from("parties").select(COLS).eq("guild_id", guildId).order("created_at");
    if (error) throw error;
    return (data ?? []) as Party[];
  }
  async get(guildId: string, id: string) {
    const { data, error } = await this.sb.from("parties").select(COLS).eq("guild_id", guildId).eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Party | null;
  }
  async save(p: Omit<Party, "id"> & { id?: string }) {
    const row = { guild_id: p.guild_id, name: p.name, note: p.note, members: p.members, updated_at: new Date().toISOString() };
    const q = p.id
      ? this.sb.from("parties").update(row).eq("guild_id", p.guild_id).eq("id", p.id)
      : this.sb.from("parties").insert(row);
    const { data, error } = await q.select(COLS).single();
    if (error) throw error;
    return data as Party;
  }
  async delete(guildId: string, id: string) {
    const { data, error } = await this.sb.from("parties").delete().eq("guild_id", guildId).eq("id", id).select("id");
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
}

export interface PartyDeps {
  store: Store;
  parties: PartyStore;
  discord: DiscordApi;
  linkKey: Buffer;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function claims(d: PartyDeps, token: unknown): LinkClaims {
  const c = verifyLink(d.linkKey, typeof token === "string" ? token : null);
  if (!c) throw new ApiError(401, "ลิงก์หมดอายุหรือไม่ถูกต้อง กดปุ่ม \"จัดปาร์ตี้\" ใน Discord เพื่อรับลิงก์ใหม่");
  return c;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** GET: everything the page needs. */
export async function loadParties(d: PartyDeps, token: string | null) {
  const c = claims(d, token);
  const [members, parties] = await Promise.all([d.store.search(c.guildId), d.parties.list(c.guildId)]);
  return {
    me: c.userId,
    expires: c.exp,
    partySize: PARTY_SIZE,
    characters: Object.fromEntries(Object.entries(CHARACTERS).map(([id, ch]) => [id, { name: ch.name, stat: ch.stat }])),
    members: members.map(({ user_id, name, char_id, level, build }) => ({ user_id, name, char_id, level, build })),
    parties,
  };
}

/** POST: save, delete or announce a party. */
export async function partyAction(d: PartyDeps, body: any) {
  const c = claims(d, body?.t);
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : undefined;

  switch (body?.action) {
    case "save": {
      const p = body.party ?? {};
      const pid = typeof p.id === "string" && UUID.test(p.id) ? p.id : undefined;
      const known = new Set((await d.store.search(c.guildId)).map((m) => m.user_id));
      const members = [...new Set<string>(Array.isArray(p.members) ? p.members.filter((u: unknown) => typeof u === "string") : [])]
        .filter((u) => known.has(u))
        .slice(0, PARTY_SIZE);
      if (!pid && (await d.parties.list(c.guildId)).length >= MAX_PARTIES)
        throw new ApiError(400, `มีปาร์ตี้ครบ ${MAX_PARTIES} แล้ว ลบปาร์ตี้เก่าก่อน`);
      if (pid && !(await d.parties.get(c.guildId, pid))) throw new ApiError(404, "ปาร์ตี้นี้ถูกลบไปแล้ว");
      const party = await d.parties.save({
        id: pid,
        guild_id: c.guildId,
        name: text(p.name, 40) || "ปาร์ตี้ใหม่",
        note: text(p.note, 100),
        members,
      });
      return { party };
    }
    case "delete": {
      if (!id) throw new ApiError(400, "ไม่พบปาร์ตี้");
      return { deleted: await d.parties.delete(c.guildId, id) };
    }
    case "announce": {
      if (!id) throw new ApiError(400, "ไม่พบปาร์ตี้");
      const party = await d.parties.get(c.guildId, id);
      if (!party) throw new ApiError(404, "ปาร์ตี้นี้ถูกลบไปแล้ว");
      const byId = new Map((await d.store.search(c.guildId)).map((m) => [m.user_id, m]));
      await d.discord.createMessage(c.channelId, announcement(party, byId, c.userId));
      return { announced: true };
    }
    default:
      throw new ApiError(400, "ไม่รู้จักคำสั่งนี้");
  }
}

export function announcement(party: Party, byId: Map<string, Member>, by: string) {
  const slots = party.members.map((u, i) => {
    const m = byId.get(u);
    if (!m) return `${i + 1}. <@${u}>`;
    const ch = CHARACTERS[m.char_id];
    return `${i + 1}. ${STAT_EMOJI[ch.stat]} **${m.name}** · ${ch.name}${m.build ? ` (${m.build})` : ""} · Lv.${m.level} <@${u}>`;
  });
  const open = PARTY_SIZE - party.members.length;
  return {
    content: party.members.map((u) => `<@${u}>`).join(" "),
    embeds: [
      {
        title: `🎉 ${party.name}`,
        color: 0xf1c40f,
        description: [party.note && `📌 ${party.note}`, ...slots, open > 0 ? `\nว่างอีก ${open} ที่` : ""]
          .filter(Boolean)
          .join("\n"),
        footer: { text: "จัดจากหน้าเว็บจัดปาร์ตี้" },
        fields: [{ name: "ประกาศโดย", value: `<@${by}>`, inline: true }],
      },
    ],
    // Ping only the party members, and the person who announced it is named in the text
    allowed_mentions: { users: party.members.slice(0, 100) },
  };
}
