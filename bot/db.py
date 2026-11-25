"""SQLite storage for registered guild characters."""

import sqlite3
import time
from dataclasses import dataclass


@dataclass
class Member:
    guild_id: int
    user_id: int
    name: str
    char_id: str
    job: str
    level: int
    updated_at: int


SCHEMA = """
CREATE TABLE IF NOT EXISTS members (
    guild_id   INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    char_id    TEXT    NOT NULL,
    job        TEXT    NOT NULL,
    level      INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS members_name ON members (guild_id, name COLLATE NOCASE);
"""


class NameTaken(Exception):
    def __init__(self, owner_id: int):
        self.owner_id = owner_id


class DB:
    def __init__(self, path: str):
        self.conn = sqlite3.connect(path)
        self.conn.executescript(SCHEMA)

    def _row(self, r) -> Member | None:
        return Member(*r) if r else None

    def get(self, guild_id: int, user_id: int) -> Member | None:
        r = self.conn.execute(
            "SELECT * FROM members WHERE guild_id=? AND user_id=?", (guild_id, user_id)
        ).fetchone()
        return self._row(r)

    def get_by_name(self, guild_id: int, name: str) -> Member | None:
        r = self.conn.execute(
            "SELECT * FROM members WHERE guild_id=? AND name=? COLLATE NOCASE", (guild_id, name)
        ).fetchone()
        return self._row(r)

    def upsert(self, guild_id: int, user_id: int, name: str, char_id: str, job: str, level: int) -> Member:
        other = self.get_by_name(guild_id, name)
        if other and other.user_id != user_id:
            raise NameTaken(other.user_id)
        now = int(time.time())
        with self.conn:
            self.conn.execute(
                """INSERT INTO members VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT (guild_id, user_id) DO UPDATE SET
                   name=excluded.name, char_id=excluded.char_id, job=excluded.job,
                   level=excluded.level, updated_at=excluded.updated_at""",
                (guild_id, user_id, name, char_id, job, level, now),
            )
        return self.get(guild_id, user_id)

    def set_level(self, guild_id: int, user_id: int, level: int) -> Member | None:
        with self.conn:
            self.conn.execute(
                "UPDATE members SET level=?, updated_at=? WHERE guild_id=? AND user_id=?",
                (level, int(time.time()), guild_id, user_id),
            )
        return self.get(guild_id, user_id)

    def delete(self, guild_id: int, user_id: int) -> bool:
        with self.conn:
            cur = self.conn.execute(
                "DELETE FROM members WHERE guild_id=? AND user_id=?", (guild_id, user_id)
            )
        return cur.rowcount > 0

    def search(
        self,
        guild_id: int,
        char_id: str | None = None,
        job: str | None = None,
        min_level: int | None = None,
        max_level: int | None = None,
    ) -> list[Member]:
        sql = "SELECT * FROM members WHERE guild_id=?"
        args: list = [guild_id]
        if char_id:
            sql += " AND char_id=?"
            args.append(char_id)
        if job:
            sql += " AND job=? COLLATE NOCASE"
            args.append(job)
        if min_level is not None:
            sql += " AND level>=?"
            args.append(min_level)
        if max_level is not None:
            sql += " AND level<=?"
            args.append(max_level)
        sql += " ORDER BY level DESC, name COLLATE NOCASE"
        return [Member(*r) for r in self.conn.execute(sql, args).fetchall()]
