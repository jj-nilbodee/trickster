// Vercel function behind the party web page (public/party.html).
import { SupabaseStore } from "../src/db.js";
import { DiscordRest } from "../src/discord.js";
import { linkKey } from "../src/partylink.js";
import { ApiError, SupabasePartyStore, loadParties, partyAction, type PartyDeps } from "../src/parties.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let deps: PartyDeps | undefined;
function getDeps() {
  deps ??= {
    store: new SupabaseStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")),
    parties: new SupabasePartyStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")),
    discord: new DiscordRest(env("DISCORD_BOT_TOKEN")),
    linkKey: linkKey(env("DISCORD_BOT_TOKEN")),
  };
  return deps;
}

async function answer(work: () => Promise<object>): Promise<Response> {
  try {
    return Response.json(await work(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    console.error("party api failed", e);
    return Response.json({ error: "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

export function GET(request: Request): Promise<Response> {
  return answer(() => loadParties(getDeps(), new URL(request.url).searchParams.get("t")));
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  return answer(() => partyAction(getDeps(), body));
}
