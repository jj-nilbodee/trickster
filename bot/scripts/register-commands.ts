// Sends the slash command list to Discord. Run again whenever the commands change:
//   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... npm run register
// Add DISCORD_GUILD_ID=... to register to one server only (shows up instantly, good for testing).
import { COMMANDS } from "../src/commands.js";

const appId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!appId || !token) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN first");
  process.exit(1);
}

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(COMMANDS),
});
if (!res.ok) {
  console.error(`Failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const list = (await res.json()) as { name: string }[];
console.log(`Registered ${list.length} commands${guildId ? ` to server ${guildId}` : " globally"}: ${list.map((c) => "/" + c.name).join(" ")}`);
