// Vercel function: Discord sends every slash command here (Interactions Endpoint URL).
import { waitUntil } from "@vercel/functions";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { COMMANDS, handleInteraction } from "../src/commands.js";
import { SupabaseStore } from "../src/db.js";
import { DiscordRest, verifySignature } from "../src/discord.js";
import { linkKey, signLink } from "../src/partylink.js";
import { SupabaseNewsStore, fetchNews } from "../src/news.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let deps: Parameters<typeof handleInteraction>[1] | undefined;
function getDeps(origin: string) {
  if (!deps) {
    const key = linkKey(env("DISCORD_BOT_TOKEN"));
    deps = {
      store: new SupabaseStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")),
      discord: new DiscordRest(env("DISCORD_BOT_TOKEN")),
      // The page lives on the same site Discord calls, e.g. https://trickster-guild-bot.vercel.app/party
      news: new SupabaseNewsStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")),
      fetchNews: () => fetchNews(),
      partyUrl: (c) => `${process.env.PUBLIC_URL || origin}/party?t=${signLink(key, c)}`,
    };
  }
  return deps;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const ok = await verifySignature(
    env("DISCORD_PUBLIC_KEY"),
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
    body,
  );
  if (!ok) return new Response("invalid request signature", { status: 401 });

  const interaction = JSON.parse(body);
  const { response, after } = await handleInteraction(interaction, getDeps(new URL(request.url).origin));
  if (after) waitUntil(after());
  if (interaction.type !== 1 && interaction.application_id) waitUntil(syncCommands(interaction.application_id));
  return Response.json(response);
}

// Re-register the slash commands whenever their definitions change, so a new command shows up
// after the next button press or command, without re-saving the endpoint URL in the Developer Portal.
let synced = false;
async function syncCommands(appId: string) {
  if (synced) return;
  try {
    const hash = createHash("sha256").update(JSON.stringify(COMMANDS)).digest("hex");
    const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
    const { data } = await sb.from("app_secrets").select("value").eq("name", "commands_hash").maybeSingle();
    if (data?.value !== hash) {
      await getDeps("").discord.registerCommands(appId, COMMANDS);
      await sb.from("app_secrets").upsert({ name: "commands_hash", value: hash }, { onConflict: "name" });
      console.log("slash commands registered");
    }
    synced = true;
  } catch (e) {
    console.error("syncing slash commands failed", e);
  }
}

export function GET(): Response {
  return new Response("Trickster guild bot is running. Discord sends commands here with POST.");
}
