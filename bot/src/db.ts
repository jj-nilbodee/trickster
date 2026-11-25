import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface Member {
  guild_id: string;
  user_id: string;
  name: string;
  char_id: string;
  job: string;
  level: number;
  /** สายที่เล่น: free text, e.g. "สาย Power" */
  build: string;
}

export interface Filters {
  charId?: string;
  job?: string;
  minLevel?: number;
  maxLevel?: number;
}

export class NameTaken extends Error {
  constructor(public ownerId: string) {
    super("name taken");
  }
}

export interface Store {
  get(guildId: string, userId: string): Promise<Member | null>;
  /** Insert or overwrite this user's character. Throws NameTaken if another user has the name. */
  upsert(m: Member): Promise<Member>;
  setLevel(guildId: string, userId: string, level: number): Promise<Member | null>;
  delete(guildId: string, userId: string): Promise<boolean>;
  search(guildId: string, f?: Filters): Promise<Member[]>;
}

const COLS = "guild_id,user_id,name,char_id,job,level,build";

export class SupabaseStore implements Store {
  private sb: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async get(guildId: string, userId: string) {
    const { data, error } = await this.sb
      .from("members")
      .select(COLS)
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data as Member | null;
  }

  async upsert(m: Member) {
    // ilike without wildcards = case-insensitive equals; escape the wildcard characters just in case
    const pattern = m.name.replace(/[\\%_]/g, (c) => "\\" + c);
    const { data: same, error: e1 } = await this.sb
      .from("members")
      .select("user_id")
      .eq("guild_id", m.guild_id)
      .ilike("name", pattern);
    if (e1) throw e1;
    const other = same?.find((r) => r.user_id !== m.user_id);
    if (other) throw new NameTaken(other.user_id);

    const { data, error } = await this.sb
      .from("members")
      .upsert({ ...m, updated_at: new Date().toISOString() }, { onConflict: "guild_id,user_id" })
      .select(COLS)
      .single();
    if (error?.code === "23505") throw new NameTaken("?"); // someone took the name at the same moment
    if (error) throw error;
    return data as Member;
  }

  async setLevel(guildId: string, userId: string, level: number) {
    const { data, error } = await this.sb
      .from("members")
      .update({ level, updated_at: new Date().toISOString() })
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .select(COLS)
      .maybeSingle();
    if (error) throw error;
    return data as Member | null;
  }

  async delete(guildId: string, userId: string) {
    const { data, error } = await this.sb
      .from("members")
      .delete()
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async search(guildId: string, f: Filters = {}) {
    let q = this.sb.from("members").select(COLS).eq("guild_id", guildId);
    if (f.charId) q = q.eq("char_id", f.charId);
    if (f.job) q = q.ilike("job", f.job);
    if (f.minLevel != null) q = q.gte("level", f.minLevel);
    if (f.maxLevel != null) q = q.lte("level", f.maxLevel);
    const { data, error } = await q.order("level", { ascending: false }).order("name").limit(500);
    if (error) throw error;
    return (data ?? []) as Member[];
  }
}
