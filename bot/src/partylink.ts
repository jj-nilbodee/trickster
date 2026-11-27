// Signed links to the party web page. The bot hands a member a link from Discord;
// the link proves which server (and channel) it came from, so the page needs no separate login.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface LinkClaims {
  guildId: string;
  userId: string;
  /** Channel the link was made in; "ประกาศ" posts the party there. */
  channelId: string;
  /** Expiry, unix seconds. */
  exp: number;
}

export const LINK_HOURS = 24;

/** The signing key is derived from the bot token, so there is no extra secret to set up. */
export function linkKey(botToken: string): Buffer {
  return createHash("sha256").update("trickster-party-link|" + botToken).digest();
}

const b64 = (b: Buffer) => b.toString("base64url");

export function signLink(key: Buffer, c: Omit<LinkClaims, "exp">, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + LINK_HOURS * 3600;
  const body = [c.guildId, c.userId, c.channelId, exp.toString(36)].join(".");
  return body + "." + b64(createHmac("sha256", key).update(body).digest()).slice(0, 32);
}

export function verifyLink(key: Buffer, token: string | null | undefined, now = Date.now()): LinkClaims | null {
  const parts = (token ?? "").split(".");
  if (parts.length !== 5 || !parts.slice(0, 3).every((p) => /^\d{1,25}$/.test(p))) return null;
  const body = parts.slice(0, 4).join(".");
  const want = Buffer.from(b64(createHmac("sha256", key).update(body).digest()).slice(0, 32));
  const got = Buffer.from(parts[4]);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const exp = parseInt(parts[3], 36);
  if (!(exp * 1000 > now)) return null;
  return { guildId: parts[0], userId: parts[1], channelId: parts[2], exp };
}
