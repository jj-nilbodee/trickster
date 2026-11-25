"""Characters and jobs in Trickster Online (from docs/data/jobs/*.json on the guide site)."""

# character id -> (display name, stat, [jobs in order: tier 1, tier 2, tier 3...])
CHARACTERS: dict[str, tuple[str, str, list[str]]] = {
    "bunny": ("Bunny", "Power", ["Schoolgirl", "Boxer", "Champion", "Duelist"]),
    "buffalo": ("Buffalo", "Power", ["Fighter", "Warrior", "Gladiator", "Mercenary"]),
    "bear": ("Bear", "Power", ["Animal Lover", "Trainer", "Zoologist"]),
    "sheep": ("Sheep", "Magic", ["Librarian", "Bard", "Soul Master", "Witch"]),
    "dragon": ("Dragon", "Magic", ["Shaman", "Magician", "Dark Lord", "Priest", "Wizard"]),
    "fox": ("Fox", "Sense", ["Archaeologist", "Explorer", "Thief Master", "Hunter Lord"]),
    "lion": ("Lion", "Sense", ["Engineer", "Inventor", "Scientist", "Cyber Hunter"]),
    "cat": ("Cat", "Charm", ["Model", "Entertainer", "Primadonna", "Diva"]),
    "raccoon": ("Raccoon", "Charm", ["Teacher", "Card Master", "Gambler", "Duke"]),
}

STAT_EMOJI = {"Power": "💪", "Magic": "🔮", "Sense": "🎯", "Charm": "💖"}

MAX_LEVEL = 999


def character_name(char_id: str) -> str:
    return CHARACTERS[char_id][0]


def jobs_for(char_id: str) -> list[str]:
    return CHARACTERS[char_id][2]


def find_job(char_id: str, text: str) -> str | None:
    """Return the job's proper name if `text` names a job of this character (case-insensitive)."""
    t = text.strip().lower()
    for job in jobs_for(char_id):
        if job.lower() == t:
            return job
    return None


def all_jobs() -> list[tuple[str, str]]:
    """All (char_id, job) pairs."""
    return [(cid, job) for cid, (_, _, jobs) in CHARACTERS.items() for job in jobs]


def char_of_job(job: str) -> str | None:
    for cid, j in all_jobs():
        if j.lower() == job.strip().lower():
            return cid
    return None
