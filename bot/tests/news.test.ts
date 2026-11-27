import { readFileSync } from "node:fs";
import { describe as group, expect, it } from "vitest";
import { checkNews, parseNews, runNewsCheck, type NewsItem, type NewsStore } from "../src/news.js";
import { handleInteraction, type Deps } from "../src/commands.js";

const html = readFileSync(new URL("./news-page.html", import.meta.url), "utf8");

class MemNews implements NewsStore {
  urls = new Set<string>();
  ch = new Map<string, string>();
  async seen(urls: string[]) { return new Set(urls.filter((u) => this.urls.has(u))); }
  async anySeen() { return this.urls.size > 0; }
  async markSeen(urls: string[]) { urls.forEach((u) => this.urls.add(u)); }
  async channels() { return [...this.ch].map(([guild_id, channel_id]) => ({ guild_id, channel_id })); }
  async setChannel(g: string, c: string | null) { c ? this.ch.set(g, c) : this.ch.delete(g); }
  async cronSecret() { return "s"; }
  h = { failures: 0, alerted: false };
  async health() { return this.h; }
  async setHealth(h: any) { this.h = h; }
}
const discord = () => ({ posted: [] as any[], async createMessage(c: string, m: any) { this.posted.push({ c, m }); } });

group("news", () => {
  it("parses the story cards on playtrickster.com/news", () => {
    const items = parseNews(html);
    expect(items.length).toBeGreaterThanOrEqual(5);
    const patch = items.find((i) => i.url.endsWith("/news/patch-note-november-27-2026"))!;
    expect(patch).toMatchObject({ title: "Patch Note: อัปเดตวันที่ 27 พฤศจิกายน 2026", category: "อัปเดต", date: "2026-11-27" });
    expect(patch.image).toMatch(/^https:\/\/playtrickster\.com\/storage\//);
    expect(patch.excerpt.length).toBeGreaterThan(20);
    expect(new Set(items.map((i) => i.url)).size).toBe(items.length);
  });

  it("first run remembers, later runs post only new stories, oldest first", async () => {
    const store = new MemNews();
    store.ch.set("g", "c1");
    const d = discord();
    const items = parseNews(html);
    expect(await checkNews(store, d as any, items)).toMatchObject({ posted: 0, firstRun: true });
    expect(await checkNews(store, d as any, items)).toMatchObject({ posted: 0 });
    const a: NewsItem = { url: "https://playtrickster.com/news/a", title: "A", excerpt: "", category: "", date: "" };
    const b: NewsItem = { ...a, url: "https://playtrickster.com/news/b", title: "B" };
    expect(await checkNews(store, d as any, [b, a, ...items])).toMatchObject({ posted: 2 });
    expect(d.posted.map((p) => p.m.embeds[0].title)).toEqual(["A", "B"]);
    expect(d.posted[0].c).toBe("c1");
    expect(await checkNews(store, d as any, [b, a, ...items])).toMatchObject({ posted: 0 });
  });

  it("/news sets and clears the channel and posts a sample", async () => {
    const news = new MemNews();
    const d = discord();
    const replies: any[] = [];
    const deps = {
      store: {}, news, fetchNews: async () => parseNews(html),
      discord: { ...d, createMessage: d.createMessage.bind(d), editReply: async (_a: string, _t: string, m: any) => { replies.push(m); } },
    } as unknown as Deps;
    const cmd = (mode?: string) => ({
      type: 2, token: "t", application_id: "a", guild_id: "g", channel_id: "c9",
      member: { user: { id: "u" }, roles: [], permissions: "32" },
      data: { name: "news", options: mode ? [{ name: "mode", value: mode }] : [] },
    });
    let h = await handleInteraction(cmd() as any, deps);
    await h.after?.();
    expect(news.ch.get("g")).toBe("c9");
    expect(d.posted).toHaveLength(1);
    expect(replies[0].content).toContain("ช่องข่าว");
    h = await handleInteraction(cmd("off") as any, deps);
    await h.after?.();
    expect(news.ch.size).toBe(0);
  });

  it("warns the channels once after 3 failed checks and again when it recovers", async () => {
    const store = new MemNews();
    store.ch.set("g", "c1");
    const d = discord();
    const blocked = async () => { throw new Error("news page answered 403"); };
    await runNewsCheck(store, d as any, blocked);
    await runNewsCheck(store, d as any, async () => []); // empty page counts too
    expect(d.posted).toHaveLength(0);
    await runNewsCheck(store, d as any, blocked);
    expect(d.posted).toHaveLength(1);
    expect(d.posted[0].m.content).toContain("ไม่ได้ติดกัน 3 รอบ");
    await runNewsCheck(store, d as any, blocked);
    expect(d.posted).toHaveLength(1); // no repeat
    const r = await runNewsCheck(store, d as any, async () => parseNews(html));
    expect(r.ok).toBe(true);
    expect(d.posted[1].m.content).toContain("ปกติแล้ว");
    expect(store.h).toEqual({ failures: 0, alerted: false });
  });
});
