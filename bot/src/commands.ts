import { CHARACTERS, MAX_LEVEL } from "./jobs.js";
import { InteractionType, ResponseType, hasManageNicknames } from "./discord.js";
import {
  deferred,
  levelAction,
  msg,
  partyLinkResponse,
  profileAction,
  registerAction,
  rosterAction,
  unregisterAction,
  type Deps,
  type Handled,
  type Interaction,
} from "./actions.js";
import { handlePanel, panelMessage } from "./panel.js";

export { applyRoleAndNick, describe, type Deps, type Handled } from "./actions.js";

// ---------- Command definitions (sent to Discord by scripts/register-commands.ts) ----------

const STRING = 3,
  INTEGER = 4,
  USER = 6;

const characterOption = (required: boolean) => ({
  type: STRING,
  name: "character",
  description: "ตัวละคร",
  required,
  choices: Object.entries(CHARACTERS).map(([id, c]) => ({ name: `${c.name} (${c.stat})`, value: id })),
});
const levelOption = (name: string, description: string, required: boolean) => ({
  type: INTEGER,
  name,
  description,
  required,
  min_value: 1,
  max_value: MAX_LEVEL,
});

const GUILD_ONLY = { contexts: [0], dm_permission: false };

export const COMMANDS = [
  {
    name: "register",
    description: "ลงทะเบียนตัวละคร บอทจะเปลี่ยนชื่อในเซิร์ฟเวอร์และให้ role ตัวละคร",
    ...GUILD_ONLY,
    options: [
      { type: STRING, name: "name", description: "ชื่อตัวละครในเกม", required: true, min_length: 1, max_length: 32 },
      characterOption(true),
      levelOption("level", "เลเวลตอนนี้", true),
      { type: STRING, name: "build", description: "สายที่เล่น เช่น สายตรง สายผสม น้ำ ไฟฟ้า", required: true, min_length: 1, max_length: 40 },
    ],
  },
  {
    name: "level",
    description: "อัปเดตเลเวลตัวละครที่ลงทะเบียนไว้",
    ...GUILD_ONLY,
    options: [levelOption("level", "เลเวลใหม่", true)],
  },
  {
    name: "profile",
    description: "ดูตัวละครที่ลงทะเบียนไว้",
    ...GUILD_ONLY,
    options: [{ type: USER, name: "member", description: "สมาชิกที่อยากดู (ว่างไว้ = ตัวเอง)", required: false }],
  },
  {
    name: "roster",
    description: "รายชื่อตัวละครทั้งหมดในกิลด์ แยกตามตัวละคร",
    ...GUILD_ONLY,
  },
  {
    name: "party",
    description: "เปิดหน้าเว็บจัดปาร์ตี้",
    ...GUILD_ONLY,
  },
  {
    name: "panel",
    description: "ตั้งแผงปุ่มลงทะเบียนถาวรในช่องนี้ (สำหรับแอดมิน)",
    ...GUILD_ONLY,
    default_member_permissions: String(1 << 5), // Manage Server
  },
  {
    name: "unregister",
    description: "ลบข้อมูลตัวละคร (แอดมินลบของคนอื่นได้)",
    ...GUILD_ONLY,
    options: [
      {
        type: USER,
        name: "member",
        description: "สมาชิกที่จะลบ (ว่างไว้ = ตัวเอง ต้องมีสิทธิ์ Manage Nicknames ถึงลบของคนอื่นได้)",
        required: false,
      },
    ],
  },
];

// ---------- Handling ----------

export async function handleInteraction(i: Interaction, d: Deps): Promise<Handled> {
  if (i.type === InteractionType.PING) {
    // Discord pings when the Interactions Endpoint URL is saved: use that moment to (re)register the slash commands
    return {
      response: { type: ResponseType.PONG },
      after: () =>
        d.discord.registerCommands(i.application_id, COMMANDS).catch((e) => console.error("registering commands failed", e)),
    };
  }
  if (!i.data) return { response: msg("ไม่รู้จักคำสั่งนี้") };
  if (!i.guild_id || !i.member?.user) return { response: msg("ใช้คำสั่งนี้ได้ในเซิร์ฟเวอร์เท่านั้น") };
  if (i.type === InteractionType.MESSAGE_COMPONENT || i.type === InteractionType.MODAL_SUBMIT) return handlePanel(i, d);
  if (i.type !== InteractionType.APPLICATION_COMMAND) return { response: msg("ไม่รู้จักคำสั่งนี้") };

  const guildId = i.guild_id;
  const me = i.member;
  const userId = me.user!.id;
  const opt = <T>(name: string) => i.data!.options?.find((o) => o.name === name)?.value as T | undefined;

  switch (i.data.name) {
    case "register": {
      const charId = opt<string>("character")!;
      const name = opt<string>("name")!;
      const level = opt<number>("level")!;
      const build = opt<string>("build") ?? "";
      return deferred(i, d, () => registerAction(d, guildId, me, { name, charId, level, build }));
    }
    case "level":
      return deferred(i, d, () => levelAction(d, guildId, userId, opt<number>("level")!));
    case "profile":
      return deferred(i, d, () => profileAction(d, guildId, userId, opt<string>("member") ?? userId));
    case "roster":
      return deferred(i, d, () => rosterAction(d, guildId));
    case "party":
      return { response: partyLinkResponse(d, i) };
    case "panel": {
      const channelId = i.channel_id!;
      return deferred(i, d, async () => {
        await d.discord.createMessage(channelId, panelMessage());
        return { content: "ตั้งแผงปุ่มแล้ว ✅ ถ้าอยากย้ายช่อง ลบข้อความเดิมแล้วใช้ /panel ในช่องใหม่" };
      });
    }
    case "unregister": {
      const target = opt<string>("member") ?? userId;
      if (target !== userId && !hasManageNicknames(me.permissions)) return { response: msg("ลบข้อมูลของคนอื่นได้เฉพาะแอดมิน") };
      const targetMember = target === userId ? me : i.data.resolved?.members?.[target];
      return deferred(i, d, () => unregisterAction(d, guildId, target, targetMember));
    }
    default:
      return { response: msg("ไม่รู้จักคำสั่งนี้") };
  }
}
