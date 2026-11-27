// Called every 10 minutes by Supabase pg_cron (see supabase/schema.sql). Posts new playtrickster.com news to Discord.
import { timingSafeEqual } from "node:crypto";
import { DiscordRest } from "../src/discord.js";
import { SupabaseNewsStore, checkNews, fetchNews } from "../src/news.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request: Request): Promise<Response> {
  const store = new SupabaseNewsStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const secret = await store.cronSecret();
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!secret || !same(given, secret)) return new Response("forbidden", { status: 403 });
  try {
    const result = await checkNews(store, new DiscordRest(env("DISCORD_BOT_TOKEN")), await fetchNews());
    return Response.json(result);
  } catch (e) {
    console.error("news check failed", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
