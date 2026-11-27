// Watches https://playtrickster.com/news and posts new stories to Discord.
// Supabase pg_cron calls api/news-cron every 10 minutes (Vercel's free plan only allows daily crons).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DiscordApi } from "./discord.js";

export const NEWS_URL = "https://playtrickster.com/news";
const SITE = "https://playtrickster.com";

export interface NewsItem {
  url: string;
  title: string;
  excerpt: string;
  image?: string;
  category: string;
  date: string; // yyyy-mm-dd
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
function clean(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#"
        ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();
}
const abs = (u: string) => (u.startsWith("http") ? u : SITE + (u.startsWith("/") ? "" : "/") + u);

/** Read the story cards on the news page, newest first as the page lists them. */
export function parseNews(html: string): NewsItem[] {
  const items: NewsItem[] = [];
  for (const [, block] of html.matchAll(/<article\b[^>]*class="[^"]*\bstory\b[^"]*"[^>]*>([\s\S]*?)<\/article>/g)) {
    const title = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const link = block.match(/<a\s[^>]*href="([^"]*\/news\/[^"]+)"/);
    if (!title || !link) continue;
    const img = block.match(/<img\s[^>]*src="([^"]+)"/);
    const meta = block.match(/class="meta"[^>]*>\s*<span>([\s\S]*?)<\/span>/);
    const date = block.match(/<time[^>]*datetime="([^"]+)"/);
    const p = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    items.push({
      url: abs(clean(link[1])),
      title: clean(title[1]),
      excerpt: p ? clean(p[1]) : "",
      image: img ? abs(clean(img[1])) : undefined,
      category: meta ? clean(meta[1]) : "",
      date: date?.[1] ?? "",
    });
  }
  return items;
}

export function newsMessage(n: NewsItem) {
  return {
    embeds: [
      {
        author: { name: `📰 ข่าว Trickster${n.category ? ` · ${n.category}` : ""}` },
        title: n.title.slice(0, 256),
        url: n.url,
        description: n.excerpt.slice(0, 400) || undefined,
        color: 0xf1c40f,
        image: n.image ? { url: n.image } : undefined,
        timestamp: /^\d{4}-\d{2}-\d{2}$/.test(n.date) ? `${n.date}T00:00:00+07:00` : undefined,
        footer: { text: "playtrickster.com" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

export interface NewsStore {
  /** Which of these urls have been seen before. */
  seen(urls: string[]): Promise<Set<string>>;
  anySeen(): Promise<boolean>;
  markSeen(urls: string[]): Promise<void>;
  channels(): Promise<{ guild_id: string; channel_id: string }[]>;
  setChannel(guildId: string, channelId: string | null): Promise<void>;
  cronSecret(): Promise<string | null>;
}

export class SupabaseNewsStore implements NewsStore {
  private sb: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  async seen(urls: string[]) {
    if (!urls.length) return new Set<string>();
    const { data, error } = await this.sb.from("news_seen").select("url").in("url", urls);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.url as string));
  }
  async anySeen() {
    const { count, error } = await this.sb.from("news_seen").select("url", { count: "exact", head: true });
    if (error) throw error;
    return (count ?? 0) > 0;
  }
  async markSeen(urls: string[]) {
    if (!urls.length) return;
    const { error } = await this.sb.from("news_seen").upsert(urls.map((url) => ({ url })), { onConflict: "url", ignoreDuplicates: true });
    if (error) throw error;
  }
  async channels() {
    const { data, error } = await this.sb.from("news_channels").select("guild_id,channel_id");
    if (error) throw error;
    return (data ?? []) as { guild_id: string; channel_id: string }[];
  }
  async setChannel(guildId: string, channelId: string | null) {
    const q = channelId
      ? this.sb.from("news_channels").upsert({ guild_id: guildId, channel_id: channelId }, { onConflict: "guild_id" })
      : this.sb.from("news_channels").delete().eq("guild_id", guildId);
    const { error } = await q;
    if (error) throw error;
  }
  async cronSecret() {
    const { data, error } = await this.sb.from("app_secrets").select("value").eq("name", "news_cron").maybeSingle();
    if (error) throw error;
    return (data?.value as string | undefined) ?? null;
  }
}

export async function fetchNews(fetcher: typeof fetch = fetch): Promise<NewsItem[]> {
  const res = await fetcher(NEWS_URL, {
    headers: { "User-Agent": "TricksterGuildBot/1.0 (Discord news relay)", Accept: "text/html" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`news page answered ${res.status}`);
  return parseNews(await res.text());
}

const MAX_PER_RUN = 5;

/**
 * Post stories not seen before to every news channel.
 * The very first run only remembers what is already there, so turning this on doesn't flood the channel.
 */
export async function checkNews(store: NewsStore, discord: DiscordApi, items: NewsItem[]) {
  if (!items.length) return { found: 0, posted: 0 };
  const urls = items.map((i) => i.url);
  if (!(await store.anySeen())) {
    await store.markSeen(urls);
    return { found: items.length, posted: 0, firstRun: true };
  }
  const seen = await store.seen(urls);
  const fresh = items.filter((i) => !seen.has(i.url)).slice(0, MAX_PER_RUN).reverse(); // oldest first
  if (!fresh.length) return { found: items.length, posted: 0 };
  const channels = await store.channels();
  for (const item of fresh) {
    for (const c of channels) {
      try {
        await discord.createMessage(c.channel_id, newsMessage(item));
      } catch (e) {
        console.error("posting news failed", c.channel_id, e);
      }
    }
  }
  // Remember everything on the page (including what was over the per-run limit) so nothing repeats
  await store.markSeen(urls);
  return { found: items.length, posted: fresh.length, channels: channels.length };
}
