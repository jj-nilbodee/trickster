"""Trickster guild Discord bot: character registration, job roles and party lookup."""

import logging
import os

import discord
from discord import app_commands

import jobs
from db import DB, Member, NameTaken

log = logging.getLogger("trickster-bot")

TOKEN = os.environ.get("DISCORD_TOKEN", "")
DB_PATH = os.environ.get("DB_PATH", "guild.db")
# "character" = one role per character (Dragon, Fox, ...); "job" = one role per job (Priest, Dark Lord, ...)
ROLE_MODE = os.environ.get("ROLE_MODE", "character").lower()
# Optional: register commands to one server only, so they show up instantly while testing
GUILD_ID = os.environ.get("GUILD_ID")

STAT_COLOUR = {
    "Power": discord.Colour.from_rgb(231, 76, 60),
    "Magic": discord.Colour.from_rgb(155, 89, 182),
    "Sense": discord.Colour.from_rgb(46, 204, 113),
    "Charm": discord.Colour.from_rgb(241, 120, 180),
}

CHAR_CHOICES = [
    app_commands.Choice(name=f"{name} ({stat})", value=cid)
    for cid, (name, stat, _) in jobs.CHARACTERS.items()
]

# Every role name the bot manages, so it can take off the old one when someone changes job
MANAGED_ROLE_NAMES = {name for name, _, _ in jobs.CHARACTERS.values()} | {
    job for _, job in jobs.all_jobs()
}


def role_name_for(char_id: str, job: str) -> str:
    return job if ROLE_MODE == "job" else jobs.character_name(char_id)


def describe(m: Member) -> str:
    stat = jobs.CHARACTERS[m.char_id][1]
    return f"{jobs.STAT_EMOJI[stat]} **{m.name}** · {jobs.character_name(m.char_id)} {m.job} · Lv.{m.level}"


class Bot(discord.Client):
    def __init__(self):
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)
        self.db = DB(DB_PATH)

    async def setup_hook(self):
        if GUILD_ID:
            g = discord.Object(id=int(GUILD_ID))
            self.tree.copy_global_to(guild=g)
            await self.tree.sync(guild=g)
        else:
            await self.tree.sync()

    async def on_ready(self):
        log.info("Logged in as %s", self.user)


bot = Bot()


async def apply_role_and_nick(member: discord.Member, m: Member) -> list[str]:
    """Rename the member and swap their job role. Returns warnings for anything that failed."""
    warnings: list[str] = []
    guild = member.guild

    # Nickname
    if member.nick != m.name:
        try:
            await member.edit(nick=m.name, reason="ลงทะเบียนตัวละคร")
        except discord.Forbidden:
            if member.id == guild.owner_id:
                warnings.append("เปลี่ยนชื่อเจ้าของเซิร์ฟเวอร์ไม่ได้ (Discord ไม่อนุญาต) ต้องเปลี่ยนชื่อเอง")
            else:
                warnings.append("เปลี่ยนชื่อไม่ได้ บอทต้องมีสิทธิ์ Manage Nicknames และ role ของบอทต้องอยู่สูงกว่า role ของสมาชิก")

    # Role
    want = role_name_for(m.char_id, m.job)
    role = discord.utils.get(guild.roles, name=want)
    if role is None:
        try:
            stat = jobs.CHARACTERS[m.char_id][1]
            role = await guild.create_role(
                name=want, colour=STAT_COLOUR[stat], mentionable=True, reason="role อาชีพสำหรับลงทะเบียน"
            )
        except discord.Forbidden:
            warnings.append(f"สร้าง role {want} ไม่ได้ บอทต้องมีสิทธิ์ Manage Roles")
            role = None

    old = [r for r in member.roles if r.name in MANAGED_ROLE_NAMES and r != role]
    try:
        if old:
            await member.remove_roles(*old, reason="เปลี่ยนอาชีพ")
        if role and role not in member.roles:
            await member.add_roles(role, reason="ลงทะเบียนตัวละคร")
    except discord.Forbidden:
        warnings.append(f"ให้ role {want} ไม่ได้ ต้องลาก role ของบอทให้อยู่สูงกว่า role อาชีพใน Server Settings > Roles")
    return warnings


async def job_autocomplete(interaction: discord.Interaction, current: str):
    char_id = getattr(interaction.namespace, "character", None)
    pairs = [(char_id, j) for j in jobs.jobs_for(char_id)] if char_id in jobs.CHARACTERS else jobs.all_jobs()
    cur = current.lower()
    out = []
    for cid, job in pairs:
        label = job if char_id else f"{job} ({jobs.character_name(cid)})"
        if cur in label.lower():
            out.append(app_commands.Choice(name=label, value=job))
    return out[:25]


def guild_only(interaction: discord.Interaction) -> bool:
    return interaction.guild is not None


@bot.tree.command(name="register", description="ลงทะเบียนตัวละคร บอทจะเปลี่ยนชื่อในเซิร์ฟเวอร์และให้ role อาชีพ")
@app_commands.describe(
    name="ชื่อตัวละครในเกม",
    character="ตัวละคร",
    job="อาชีพตอนนี้",
    level="เลเวลตอนนี้",
)
@app_commands.choices(character=CHAR_CHOICES)
@app_commands.autocomplete(job=job_autocomplete)
@app_commands.check(guild_only)
async def register(
    interaction: discord.Interaction,
    name: app_commands.Range[str, 1, 32],
    character: app_commands.Choice[str],
    job: str,
    level: app_commands.Range[int, 1, jobs.MAX_LEVEL],
):
    char_id = character.value
    proper_job = jobs.find_job(char_id, job)
    if not proper_job:
        options = ", ".join(jobs.jobs_for(char_id))
        await interaction.response.send_message(
            f"{jobs.character_name(char_id)} ไม่มีอาชีพ **{job}** เลือกได้: {options}", ephemeral=True
        )
        return

    name = name.strip()
    try:
        m = bot.db.upsert(interaction.guild_id, interaction.user.id, name, char_id, proper_job, level)
    except NameTaken as e:
        await interaction.response.send_message(
            f"ชื่อ **{name}** มีคนลงทะเบียนไว้แล้ว (<@{e.owner_id}>)", ephemeral=True
        )
        return

    await interaction.response.defer(ephemeral=True)
    warnings = await apply_role_and_nick(interaction.user, m)
    text = f"ลงทะเบียนแล้ว ✅\n{describe(m)}"
    if warnings:
        text += "\n\n⚠️ " + "\n⚠️ ".join(warnings)
    await interaction.followup.send(text, ephemeral=True)


@bot.tree.command(name="level", description="อัปเดตเลเวลตัวละครที่ลงทะเบียนไว้")
@app_commands.describe(level="เลเวลใหม่")
@app_commands.check(guild_only)
async def level_cmd(interaction: discord.Interaction, level: app_commands.Range[int, 1, jobs.MAX_LEVEL]):
    m = bot.db.set_level(interaction.guild_id, interaction.user.id, level)
    if not m:
        await interaction.response.send_message("ยังไม่ได้ลงทะเบียน ใช้ /register ก่อน", ephemeral=True)
        return
    await interaction.response.send_message(f"อัปเดตแล้ว ✅\n{describe(m)}", ephemeral=True)


@bot.tree.command(name="profile", description="ดูตัวละครที่ลงทะเบียนไว้")
@app_commands.describe(member="สมาชิกที่อยากดู (ว่างไว้ = ตัวเอง)")
@app_commands.check(guild_only)
async def profile(interaction: discord.Interaction, member: discord.Member | None = None):
    target = member or interaction.user
    m = bot.db.get(interaction.guild_id, target.id)
    if not m:
        who = "คุณ" if target == interaction.user else target.mention
        await interaction.response.send_message(f"{who} ยังไม่ได้ลงทะเบียน", ephemeral=True)
        return
    await interaction.response.send_message(f"{describe(m)}\n<@{m.user_id}>", ephemeral=True)


def member_list_embed(title: str, members: list[Member]) -> discord.Embed:
    emb = discord.Embed(title=title, colour=discord.Colour.gold())
    if not members:
        emb.description = "ไม่พบสมาชิกที่ตรงเงื่อนไข"
        return emb
    lines = [f"{describe(m)} <@{m.user_id}>" for m in members]
    # Embed description limit is 4096 characters
    text, shown = "", 0
    for line in lines:
        if len(text) + len(line) + 1 > 3900:
            break
        text += line + "\n"
        shown += 1
    if shown < len(lines):
        text += f"…และอีก {len(lines) - shown} คน"
    emb.description = text
    emb.set_footer(text=f"ทั้งหมด {len(members)} คน")
    return emb


@bot.tree.command(name="party", description="หาสมาชิกสำหรับจัดปาร์ตี้ ตามตัวละคร อาชีพ หรือช่วงเลเวล")
@app_commands.describe(
    character="ตัวละคร",
    job="อาชีพ",
    min_level="เลเวลต่ำสุด",
    max_level="เลเวลสูงสุด",
    show_all="ให้ทุกคนในห้องเห็นผลลัพธ์ (ค่าเริ่มต้น: เห็นคนเดียว)",
)
@app_commands.choices(character=CHAR_CHOICES)
@app_commands.autocomplete(job=job_autocomplete)
@app_commands.check(guild_only)
async def party(
    interaction: discord.Interaction,
    character: app_commands.Choice[str] | None = None,
    job: str | None = None,
    min_level: app_commands.Range[int, 1, jobs.MAX_LEVEL] | None = None,
    max_level: app_commands.Range[int, 1, jobs.MAX_LEVEL] | None = None,
    show_all: bool = False,
):
    char_id = character.value if character else None
    found = bot.db.search(interaction.guild_id, char_id, job, min_level, max_level)
    parts = []
    if character:
        parts.append(jobs.character_name(char_id))
    if job:
        parts.append(job)
    if min_level or max_level:
        parts.append(f"Lv.{min_level or 1}–{max_level or jobs.MAX_LEVEL}")
    title = "หาปาร์ตี้" + (f": {' · '.join(parts)}" if parts else "")
    await interaction.response.send_message(embed=member_list_embed(title, found), ephemeral=not show_all)


@bot.tree.command(name="roster", description="รายชื่อตัวละครทั้งหมดในกิลด์ แยกตามตัวละคร")
@app_commands.check(guild_only)
async def roster(interaction: discord.Interaction):
    all_members = bot.db.search(interaction.guild_id)
    emb = discord.Embed(title="สมาชิกกิลด์", colour=discord.Colour.gold())
    for cid, (cname, stat, _) in jobs.CHARACTERS.items():
        ms = [m for m in all_members if m.char_id == cid]
        if not ms:
            continue
        value = "\n".join(f"{m.name} · {m.job} · Lv.{m.level}" for m in ms)
        if len(value) > 1024:
            value = value[:1000].rsplit("\n", 1)[0] + "\n…"
        emb.add_field(name=f"{jobs.STAT_EMOJI[stat]} {cname} ({len(ms)})", value=value, inline=True)
    if not all_members:
        emb.description = "ยังไม่มีใครลงทะเบียน"
    emb.set_footer(text=f"ทั้งหมด {len(all_members)} คน")
    await interaction.response.send_message(embed=emb, ephemeral=True)


@bot.tree.command(name="unregister", description="ลบข้อมูลตัวละคร (แอดมินลบของคนอื่นได้)")
@app_commands.describe(member="สมาชิกที่จะลบ (ว่างไว้ = ตัวเอง ต้องมีสิทธิ์ Manage Nicknames ถึงลบของคนอื่นได้)")
@app_commands.check(guild_only)
async def unregister(interaction: discord.Interaction, member: discord.Member | None = None):
    target = member or interaction.user
    if target != interaction.user and not interaction.user.guild_permissions.manage_nicknames:
        await interaction.response.send_message("ลบข้อมูลของคนอื่นได้เฉพาะแอดมิน", ephemeral=True)
        return
    if not bot.db.delete(interaction.guild_id, target.id):
        await interaction.response.send_message("ไม่มีข้อมูลให้ลบ", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    try:
        old = [r for r in target.roles if r.name in MANAGED_ROLE_NAMES]
        if old:
            await target.remove_roles(*old, reason="ยกเลิกลงทะเบียน")
        await target.edit(nick=None, reason="ยกเลิกลงทะเบียน")
    except discord.Forbidden:
        pass
    await interaction.followup.send(f"ลบข้อมูลของ {target.mention} แล้ว", ephemeral=True)


@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.CheckFailure):
        msg = "ใช้คำสั่งนี้ได้ในเซิร์ฟเวอร์เท่านั้น"
    else:
        log.exception("command failed", exc_info=error)
        msg = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"
    if interaction.response.is_done():
        await interaction.followup.send(msg, ephemeral=True)
    else:
        await interaction.response.send_message(msg, ephemeral=True)


def main():
    logging.basicConfig(level=logging.INFO)
    if not TOKEN:
        raise SystemExit("ตั้งค่า DISCORD_TOKEN ก่อน (ดู bot/README.md)")
    bot.run(TOKEN, log_handler=None)


if __name__ == "__main__":
    main()
