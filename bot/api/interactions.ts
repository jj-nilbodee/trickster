// Vercel function: Discord sends every slash command here (Interactions Endpoint URL).
import { waitUntil } from "@vercel/functions";
import { handleInteraction } from "../src/commands.js";
import { SupabaseStore } from "../src/db.js";
import { DiscordRest, verifySignature } from "../src/discord.js";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

let deps: Parameters<typeof handleInteraction>[1] | undefined;
function getDeps() {
  deps ??= {
    store: new SupabaseStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")),
    discord: new DiscordRest(env("DISCORD_BOT_TOKEN")),
    roleMode: process.env.ROLE_MODE === "job" ? "job" : "character",
  };
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

  const { response, after } = await handleInteraction(JSON.parse(body), getDeps());
  if (after) waitUntil(after());
  return Response.json(response);
}

export function GET(): Response {
  return new Response("Trickster guild bot is running. Discord sends commands here with POST.");
}
