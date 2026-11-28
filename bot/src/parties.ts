// Parties made on the party web page (public/party.html), and the API behind it (api/party.ts).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHARACTERS, STAT_EMOJI } from "./jobs.js";
import type { Member, Store } from "./db.js";
import type { DiscordApi } from "./discord.js";
import { verifyLink, type LinkClaims } from "./partylink.js";

/** Trickster parties hold up to 6 characters. */
export const PARTY_SIZE = 6;
export const MAX_PARTIES = 40;
export const MAX_DUMMIES = 100;
/** Party slots that hold a dummy character store "dummy:<id>" instead of a Discord user id. */
export const DUMMY_PREFIX = "dummy:";
export const isDummy = (slot: string) => slot.startsWith(DUMMY_PREFIX);

/** A stand-in character that isn't a registered member, e.g. a friend outside Discord. */
export interface Dummy {
  id: string;
  guild_id: string;
  name: string;
  char_id: string;
  level: number;
  build: string;
}

export interface Party {
  id: string;
  guild_id: string;
  name: string;
  /** Free text: when and where, e.g. "ToC 3 ทุ่ม" */
  note: string;
  /** Discord user ids of registered members, or "dummy:<id>", in slot order. */
  members: string[];
  updated_at?: string;
}

export interface PartyStore {
  list(guildId: string): Promise<Party[]>;
  get(guildId: string, id: string): Promise<Party | null>;
  /** Insert when id is empty, otherwise update that party. */
  save(p: Omit<Party, "id"> & { id?: string }): Promise<Party>;
  delete(guildId: string, id: string): Promise<boolean>;
  listDummies(guildId: string): Promise<Dummy[]>;
  addDummy(d: Omit<Dummy, "id">): Promise<Dummy>;
  deleteDummy(guildId: string, id: string): Promise<boolean>;
  /** The server's fixed channel for party announcements, if one is set. */
  announceChannel?(guildId: string): Promise<string | null>;
}

const COLS = "id,guild_id,name,note,members,updated_at";
const DUMMY_COLS = "id,guild_id,name,char_id,level,build";
// The party_dummies table is new: until its SQL has been run, the page works without dummies
const missingTable = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";
const NO_DUMMY_TABLE = "ยังเพิ่มตัวละคร dummy ไม่ได้ ต้องรัน SQL ตาราง party_dummies ใน Supabase ก่อน";

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
  async listDummies(guildId: string) {
    const { data, error } = await this.sb.from("party_dummies").select(DUMMY_COLS).eq("guild_id", guildId).order("created_at");
    if (missingTable(error)) return [];
    if (error) throw error;
    return (data ?? []) as Dummy[];
  }
  async addDummy(d: Omit<Dummy, "id">) {
    const { data, error } = await this.sb.from("party_dummies").insert(d).select(DUMMY_COLS).single();
    if (missingTable(error)) throw new ApiError(503, NO_DUMMY_TABLE);
    if (error) throw error;
    return data as Dummy;
  }
  async deleteDummy(guildId: string, id: string) {
    const { data, error } = await this.sb.from("party_dummies").delete().eq("guild_id", guildId).eq("id", id).select("id");
    if (missingTable(error)) return false;
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
  async announceChannel(guildId: string) {
    const { data, error } = await this.sb.from("party_channels").select("channel_id").eq("guild_id", guildId).maybeSingle();
    if (error) throw error;
    return (data?.channel_id as string | undefined) ?? null;
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
  const [members, parties, dummies] = await Promise.all([
    d.store.search(c.guildId),
    d.parties.list(c.guildId),
    d.parties.listDummies(c.guildId),
  ]);
  return {
    me: c.userId,
    expires: c.exp,
    partySize: PARTY_SIZE,
    characters: Object.fromEntries(Object.entries(CHARACTERS).map(([id, ch]) => [id, { name: ch.name, stat: ch.stat }])),
    members: [
      ...members.map(({ user_id, name, char_id, level, build }) => ({ user_id, name, char_id, level, build })),
      // Dummies sit in the same list, so the page places them exactly like members
      ...dummies.map(({ id, name, char_id, level, build }) => ({ user_id: DUMMY_PREFIX + id, name, char_id, level, build, dummy: true })),
    ],
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
      const known = new Set([
        ...(await d.store.search(c.guildId)).map((m) => m.user_id),
        ...(await d.parties.listDummies(c.guildId)).map((x) => DUMMY_PREFIX + x.id),
      ]);
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
    case "add_dummy": {
      const x = body.dummy ?? {};
      const name = text(x.name, 32);
      if (!name) throw new ApiError(400, "ใส่ชื่อตัวละครก่อน");
      if (typeof x.char_id !== "string" || !CHARACTERS[x.char_id]) throw new ApiError(400, "เลือกตัวละครก่อน");
      const level = Math.trunc(Number(x.level));
      if (!(level >= 1 && level <= 999)) throw new ApiError(400, "เลเวลต้องอยู่ระหว่าง 1 ถึง 999");
      if ((await d.parties.listDummies(c.guildId)).length >= MAX_DUMMIES)
        throw new ApiError(400, `มีตัวละคร dummy ครบ ${MAX_DUMMIES} ตัวแล้ว ลบตัวเก่าก่อน`);
      const dummy = await d.parties.addDummy({ guild_id: c.guildId, name, char_id: x.char_id, level, build: text(x.build, 40) });
      return { member: { user_id: DUMMY_PREFIX + dummy.id, name, char_id: dummy.char_id, level, build: dummy.build, dummy: true } };
    }
    case "delete_dummy": {
      if (!id) throw new ApiError(400, "ไม่พบตัวละคร");
      const deleted = await d.parties.deleteDummy(c.guildId, id);
      // Take it out of every party it was in
      const slot = DUMMY_PREFIX + id;
      for (const p of await d.parties.list(c.guildId))
        if (p.members.includes(slot)) await d.parties.save({ ...p, members: p.members.filter((u) => u !== slot) });
      return { deleted };
    }
    case "announce_all": {
      // The page draws every party with members into one picture; the bot posts it and tags everyone in it
      const png = decodePng(body.image);
      const parties = (await d.parties.list(c.guildId)).filter((p) => p.members.length);
      if (!parties.length) throw new ApiError(400, "ยังไม่มีปาร์ตี้ที่มีคน");
      const users = [...new Set(parties.flatMap((p) => p.members))].filter((u) => !isDummy(u));
      const channel = (await d.parties.announceChannel?.(c.guildId)) || c.channelId;
      await d.discord.createMessageWithFile(
        channel,
        {
          content: `📣 **จัดปาร์ตี้แล้ว ${parties.length} ปาร์ตี้**\n${users.map((u) => `<@${u}>`).join(" ")}`.slice(0, 2000),
          allowed_mentions: { users: users.slice(0, 100) },
        },
        { name: "parties.png", type: "image/png", data: png },
      );
      return { announced: parties.length };
    }
    case "announce": {
      if (!id) throw new ApiError(400, "ไม่พบปาร์ตี้");
      const party = await d.parties.get(c.guildId, id);
      if (!party) throw new ApiError(404, "ปาร์ตี้นี้ถูกลบไปแล้ว");
      const byId = new Map<string, Slot>((await d.store.search(c.guildId)).map((m) => [m.user_id, m]));
      for (const x of await d.parties.listDummies(c.guildId)) byId.set(DUMMY_PREFIX + x.id, { ...x, dummy: true });
      // A fixed party channel wins; otherwise post where the link was made
      const channel = (await d.parties.announceChannel?.(c.guildId)) || c.channelId;
      await d.discord.createMessage(channel, announcement(party, byId));
      return { announced: true };
    }
    default:
      throw new ApiError(400, "ไม่รู้จักคำสั่งนี้");
  }
}

const MAX_IMAGE = 3 * 1024 * 1024;
export function decodePng(b64: unknown): Uint8Array {
  if (typeof b64 !== "string" || b64.length > MAX_IMAGE * 1.4) throw new ApiError(400, "รูปใหญ่เกินไป");
  const buf = Buffer.from(b64.replace(/^data:image\/png;base64,/, ""), "base64");
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 8 || buf.length > MAX_IMAGE || !sig.every((v, i) => buf[i] === v)) throw new ApiError(400, "รูปไม่ถูกต้อง");
  return new Uint8Array(buf);
}

type Slot = Pick<Member, "name" | "char_id" | "level" | "build"> & { dummy?: boolean };

export function announcement(party: Party, byId: Map<string, Slot>) {
  const users = party.members.filter((u) => !isDummy(u));
  const slots = party.members.map((u, i) => {
    const m = byId.get(u);
    if (!m) return isDummy(u) ? "" : `${i + 1}. <@${u}>`;
    const ch = CHARACTERS[m.char_id];
    return `${i + 1}. ${STAT_EMOJI[ch.stat]} **${m.name}** · ${ch.name}${m.build ? ` (${m.build})` : ""} · Lv.${m.level} ${m.dummy ? "(dummy)" : `<@${u}>`}`;
  });
  const open = PARTY_SIZE - party.members.length;
  return {
    content: users.map((u) => `<@${u}>`).join(" "),
    embeds: [
      {
        title: `🎉 ${party.name}`,
        color: 0xf1c40f,
        description: [...slots, open > 0 ? `\nว่างอีก ${open} ที่` : ""]
          .filter(Boolean)
          .join("\n"),
        footer: { text: "จัดจากหน้าเว็บจัดปาร์ตี้" },
      },
    ],
    // Ping only the party members, and the person who announced it is named in the text
    allowed_mentions: { users: users.slice(0, 100) },
  };
}
