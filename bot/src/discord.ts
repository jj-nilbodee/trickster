import { webcrypto } from "node:crypto";

const API = "https://discord.com/api/v10";

// Interaction and response types (https://discord.com/developers/docs/interactions/receiving-and-responding)
export const InteractionType = { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3, AUTOCOMPLETE: 4, MODAL_SUBMIT: 5 } as const;
export const ResponseType = {
  PONG: 1,
  MESSAGE: 4,
  DEFERRED_MESSAGE: 5,
  DEFERRED_UPDATE: 6,
  UPDATE_MESSAGE: 7,
  AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;
export const EPHEMERAL = 1 << 6;
const MANAGE_NICKNAMES = 1n << 27n;
const ADMINISTRATOR = 1n << 3n;

export function hasManageNicknames(permissions: string | undefined): boolean {
  if (!permissions) return false;
  const p = BigInt(permissions);
  return (p & MANAGE_NICKNAMES) !== 0n || (p & ADMINISTRATOR) !== 0n;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Check that a request really came from Discord (Ed25519 signature over timestamp + body). */
export async function verifySignature(
  publicKeyHex: string,
  signatureHex: string | null,
  timestamp: string | null,
  body: string,
): Promise<boolean> {
  if (!signatureHex || !timestamp || !/^[0-9a-f]+$/i.test(signatureHex)) return false;
  try {
    const key = await webcrypto.subtle.importKey("raw", hexToBytes(publicKeyHex), { name: "Ed25519" }, false, [
      "verify",
    ]);
    return await webcrypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signatureHex),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

export class DiscordError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Discord API ${status}: ${body}`);
  }
}

export interface Role {
  id: string;
  name: string;
}

export interface Guild {
  owner_id: string;
  roles: Role[];
}

/** The few Discord REST calls the bot needs. An interface so tests can fake it. */
export interface DiscordApi {
  getGuild(guildId: string): Promise<Guild>;
  createRole(guildId: string, name: string, colour: number): Promise<Role>;
  setNick(guildId: string, userId: string, nick: string | null): Promise<void>;
  addRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
  editReply(appId: string, token: string, message: object): Promise<void>;
  createMessage(channelId: string, message: object): Promise<void>;
}

export class DiscordRest implements DiscordApi {
  constructor(private botToken: string) {}

  private async call(method: string, path: string, body?: object, reason?: string, auth = true) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) headers.Authorization = `Bot ${this.botToken}`;
    if (reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(reason);
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new DiscordError(res.status, await res.text());
    return res.status === 204 ? null : res.json();
  }

  getGuild(guildId: string) {
    return this.call("GET", `/guilds/${guildId}`) as Promise<Guild>;
  }
  createRole(guildId: string, name: string, colour: number) {
    return this.call("POST", `/guilds/${guildId}/roles`, { name, color: colour, mentionable: true }, "role อาชีพ") as Promise<Role>;
  }
  async setNick(guildId: string, userId: string, nick: string | null) {
    await this.call("PATCH", `/guilds/${guildId}/members/${userId}`, { nick }, "ลงทะเบียนตัวละคร");
  }
  async addRole(guildId: string, userId: string, roleId: string) {
    await this.call("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, undefined, "ลงทะเบียนตัวละคร");
  }
  async removeRole(guildId: string, userId: string, roleId: string) {
    await this.call("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, undefined, "เปลี่ยนอาชีพ");
  }
  async editReply(appId: string, token: string, message: object) {
    await this.call("PATCH", `/webhooks/${appId}/${token}/messages/@original`, message, undefined, false);
  }
  async createMessage(channelId: string, message: object) {
    await this.call("POST", `/channels/${channelId}/messages`, message);
  }
}
