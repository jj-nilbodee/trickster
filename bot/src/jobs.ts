// Characters and jobs in Trickster Online (from docs/data/jobs/*.json on the guide site).

export type Stat = "Power" | "Magic" | "Sense" | "Charm";

export interface Character {
  name: string;
  stat: Stat;
  jobs: string[]; // tier 1, tier 2, then tier 3 jobs
}

export const CHARACTERS: Record<string, Character> = {
  bunny: { name: "Bunny", stat: "Power", jobs: ["Schoolgirl", "Boxer", "Champion", "Duelist"] },
  buffalo: { name: "Buffalo", stat: "Power", jobs: ["Fighter", "Warrior", "Gladiator", "Mercenary"] },
  bear: { name: "Bear", stat: "Power", jobs: ["Animal Lover", "Trainer", "Zoologist"] },
  sheep: { name: "Sheep", stat: "Magic", jobs: ["Librarian", "Bard", "Soul Master", "Witch"] },
  dragon: { name: "Dragon", stat: "Magic", jobs: ["Shaman", "Magician", "Dark Lord", "Priest", "Wizard"] },
  fox: { name: "Fox", stat: "Sense", jobs: ["Archaeologist", "Explorer", "Thief Master", "Hunter Lord"] },
  lion: { name: "Lion", stat: "Sense", jobs: ["Engineer", "Inventor", "Scientist", "Cyber Hunter"] },
  cat: { name: "Cat", stat: "Charm", jobs: ["Model", "Entertainer", "Primadonna", "Diva"] },
  raccoon: { name: "Raccoon", stat: "Charm", jobs: ["Teacher", "Card Master", "Gambler", "Duke"] },
};

export const STAT_EMOJI: Record<Stat, string> = { Power: "💪", Magic: "🔮", Sense: "🎯", Charm: "💖" };
export const STAT_COLOUR: Record<Stat, number> = {
  Power: 0xe74c3c,
  Magic: 0x9b59b6,
  Sense: 0x2ecc71,
  Charm: 0xf178b4,
};

export const MAX_LEVEL = 999;

export function findJob(charId: string, text: string): string | undefined {
  const t = text.trim().toLowerCase();
  return CHARACTERS[charId]?.jobs.find((j) => j.toLowerCase() === t);
}

export function allJobs(): [string, string][] {
  return Object.entries(CHARACTERS).flatMap(([id, c]) => c.jobs.map((j) => [id, j] as [string, string]));
}

/** Every role name the bot manages, so it can take off the old one when someone changes job. */
export const MANAGED_ROLE_NAMES = new Set<string>([
  ...Object.values(CHARACTERS).map((c) => c.name),
  ...allJobs().map(([, j]) => j),
]);
