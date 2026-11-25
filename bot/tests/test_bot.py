import asyncio
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ["DB_PATH"] = ":memory:"

import discord
import pytest

import jobs
from db import DB, NameTaken


def test_jobs_match_site_data():
    import json, glob
    here = os.path.dirname(__file__)
    for f in glob.glob(os.path.join(here, "../../docs/data/jobs/*.json")):
        d = json.load(open(f))
        assert d["id"] in jobs.CHARACTERS
        for job in jobs.jobs_for(d["id"]):
            assert job in d["path"], (job, d["path"])
    assert jobs.find_job("dragon", "priest") == "Priest"
    assert jobs.find_job("dragon", "Boxer") is None


def test_db_register_update_search():
    db = DB(":memory:")
    db.upsert(1, 10, "Mingo", "dragon", "Priest", 150)
    db.upsert(1, 11, "Sppo", "bunny", "Champion", 120)
    db.upsert(2, 12, "Mingo", "fox", "Explorer", 50)  # same name in another server is fine
    with pytest.raises(NameTaken):
        db.upsert(1, 11, "mingo", "bunny", "Champion", 120)
    m = db.upsert(1, 10, "Mingo2", "dragon", "Dark Lord", 151)  # re-register overwrites
    assert (m.name, m.job, m.level) == ("Mingo2", "Dark Lord", 151)
    assert db.set_level(1, 11, 130).level == 130
    assert db.set_level(1, 99, 130) is None
    assert [x.name for x in db.search(1)] == ["Mingo2", "Sppo"]
    assert [x.name for x in db.search(1, job="dark lord")] == ["Mingo2"]
    assert [x.name for x in db.search(1, min_level=100, max_level=140)] == ["Sppo"]
    assert [x.name for x in db.search(1, char_id="bunny")] == ["Sppo"]
    assert db.delete(1, 11) and not db.delete(1, 11)


class FakeRole:
    def __init__(self, name):
        self.name = name


class FakeGuild:
    def __init__(self):
        self.roles = [FakeRole("Bunny"), FakeRole("Admin")]
        self.owner_id = 1

    async def create_role(self, name, **kw):
        r = FakeRole(name)
        self.roles.append(r)
        return r


class FakeMember:
    def __init__(self, guild, uid=5):
        self.guild, self.id, self.nick = guild, uid, None
        self.roles = [guild.roles[0], guild.roles[1]]

    async def edit(self, nick, reason=None):
        if self.id == self.guild.owner_id:
            raise discord.Forbidden(SimpleNamespace(status=403, reason="x"), "x")
        self.nick = nick

    async def add_roles(self, *roles, reason=None):
        self.roles += roles

    async def remove_roles(self, *roles, reason=None):
        self.roles = [r for r in self.roles if r not in roles]


def test_apply_role_and_nick_swaps_job_role():
    import bot
    g = FakeGuild()
    mem = FakeMember(g)
    m = bot.bot.db.upsert(9, 5, "Mingo", "dragon", "Priest", 150)
    warnings = asyncio.run(bot.apply_role_and_nick(mem, m))
    assert warnings == []
    assert mem.nick == "Mingo"
    assert sorted(r.name for r in mem.roles) == ["Admin", "Dragon"]


def test_owner_nickname_warns():
    import bot
    g = FakeGuild()
    owner = FakeMember(g, uid=1)
    m = bot.bot.db.upsert(9, 1, "Boss", "fox", "Explorer", 99)
    warnings = asyncio.run(bot.apply_role_and_nick(owner, m))
    assert len(warnings) == 1 and "เจ้าของ" in warnings[0]
    assert "Fox" in [r.name for r in owner.roles]
