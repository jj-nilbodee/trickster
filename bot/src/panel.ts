// The button panel: a permanent message with buttons, posted by an admin with /panel.
// Buttons open menus and forms so members don't need to type slash commands.
import { CHARACTERS, MAX_LEVEL, STAT_EMOJI } from "./jobs.js";
import type { Member } from "./db.js";
import {
  deferred,
  levelAction,
  msg,
  partyLinkResponse,
  profileAction,
  registerAction,
  rosterAction,
  type Deps,
  type Handled,
  type Interaction,
} from "./actions.js";
import { EPHEMERAL, InteractionType, ResponseType } from "./discord.js";

const ACTION_ROW = 1,
  BUTTON = 2,
  STRING_SELECT = 3,
  TEXT_INPUT = 4;
const PRIMARY = 1,
  SECONDARY = 2,
  SUCCESS = 3;
const SHORT = 1;

export function panelMessage() {
  return {
    embeds: [
      {
        title: "🃏 ลงทะเบียนตัวละครกิลด์",
        color: 0xf1c40f,
        description: [
          "**📝 ลงทะเบียน / แก้ไข** เลือกตัวละคร แล้วกรอกชื่อและเลเวล บอทจะเปลี่ยนชื่อในเซิร์ฟเวอร์เป็นชื่อตัวละคร และให้ role ตัวละคร",
          "**⬆️ อัปเดตเลเวล** แก้เลเวลอย่างเดียว",
          "**🎉 จัดปาร์ตี้** เปิดหน้าเว็บจัดปาร์ตี้จากรายชื่อคนที่ลงทะเบียน แล้วประกาศลงช่องนี้",
          "",
          "ผลลัพธ์จะเห็นแค่คนที่กดเท่านั้น",
        ].join("\n"),
      },
    ],
    components: [
      {
        type: ACTION_ROW,
        components: [
          { type: BUTTON, style: SUCCESS, label: "ลงทะเบียน / แก้ไข", emoji: { name: "📝" }, custom_id: "panel:register" },
          { type: BUTTON, style: PRIMARY, label: "อัปเดตเลเวล", emoji: { name: "⬆️" }, custom_id: "panel:level" },
          { type: BUTTON, style: SECONDARY, label: "ข้อมูลของฉัน", emoji: { name: "👤" }, custom_id: "panel:profile" },
        ],
      },
      {
        type: ACTION_ROW,
        components: [
          { type: BUTTON, style: SECONDARY, label: "รายชื่อกิลด์", emoji: { name: "📋" }, custom_id: "panel:roster" },
          { type: BUTTON, style: PRIMARY, label: "จัดปาร์ตี้", emoji: { name: "🎉" }, custom_id: "panel:party" },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

const ephemeralMessage = (content: string, components: object[]) => ({
  type: ResponseType.MESSAGE,
  data: { content, flags: EPHEMERAL, components },
});
const textInput = (custom_id: string, label: string, o: { required?: boolean; max?: number; value?: string; placeholder?: string } = {}) => ({
  type: ACTION_ROW,
  components: [
    {
      type: TEXT_INPUT,
      custom_id,
      label,
      style: SHORT,
      required: o.required ?? true,
      max_length: o.max ?? 32,
      ...(o.value ? { value: o.value } : {}),
      ...(o.placeholder ? { placeholder: o.placeholder } : {}),
    },
  ],
});

function characterSelect(customId: string, placeholder: string) {
  return {
    type: ACTION_ROW,
    components: [
      {
        type: STRING_SELECT,
        custom_id: customId,
        placeholder,
        options: Object.entries(CHARACTERS).map(([id, c]) => ({
          label: c.name,
          description: `สาย ${c.stat}`,
          value: id,
          emoji: { name: STAT_EMOJI[c.stat] },
        })),
      },
    ],
  };
}

/** Look up the member's saved character, but give up after a moment: a form must open within 3 seconds. */
async function quickGet(d: Deps, guildId: string, userId: string): Promise<Member | null> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1200));
  return Promise.race([d.store.get(guildId, userId).catch(() => null), timeout]);
}

function parseLevel(text: string | undefined): number | undefined | "bad" {
  const t = (text ?? "").trim();
  if (!t) return undefined;
  const n = Number(t.replace(/^lv\.?\s*/i, ""));
  return Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL ? n : "bad";
}

function field(i: Interaction, id: string): string | undefined {
  for (const row of i.data?.components ?? []) for (const c of row.components) if (c.custom_id === id) return c.value;
  return undefined;
}

export async function handlePanel(i: Interaction, d: Deps): Promise<Handled> {
  const guildId = i.guild_id!;
  const me = i.member!;
  const userId = me.user!.id;
  const id = i.data?.custom_id ?? "";

  if (i.type === InteractionType.MESSAGE_COMPONENT) {
    switch (id) {
      case "panel:register":
        return { response: ephemeralMessage("**ขั้นที่ 1/2** เลือกตัวละคร", [characterSelect("reg:char", "เลือกตัวละคร")]) };
      case "panel:level": {
        const m = await quickGet(d, guildId, userId);
        return {
          response: {
            type: ResponseType.MODAL,
            data: {
              custom_id: "modal:level",
              title: "อัปเดตเลเวล",
              components: [textInput("level", "เลเวลใหม่", { max: 3, value: m ? String(m.level) : undefined })],
            },
          },
        };
      }
      case "panel:profile":
        return deferred(i, d, () => profileAction(d, guildId, userId, userId));
      case "panel:roster":
        return deferred(i, d, () => rosterAction(d, guildId));
      case "panel:party":
        return { response: partyLinkResponse(d, i) };
      case "reg:char": {
        const charId = i.data?.values?.[0] ?? "";
        if (!CHARACTERS[charId]) return { response: msg("เลือกตัวละครใหม่อีกครั้ง") };
        const m = await quickGet(d, guildId, userId);
        return {
          response: {
            type: ResponseType.MODAL,
            data: {
              custom_id: `modal:reg:${charId}`,
              title: `ขั้นที่ 2/2 ลงทะเบียน ${CHARACTERS[charId].name}`.slice(0, 45),
              components: [
                textInput("name", "ชื่อตัวละครในเกม", { value: m?.name }),
                textInput("level", "เลเวลตอนนี้", { max: 3, value: m ? String(m.level) : undefined }),
                textInput("build", "สายที่เล่น", { max: 40, value: m?.build || undefined, placeholder: "เช่น สายตรง สายผสม น้ำ ไฟฟ้า" }),
              ],
            },
          },
        };
      }
    }
  }

  if (i.type === InteractionType.MODAL_SUBMIT) {
    if (id.startsWith("modal:reg:")) {
      const charId = id.slice("modal:reg:".length).split(":")[0];
      const name = (field(i, "name") ?? "").trim();
      const level = parseLevel(field(i, "level"));
      const build = (field(i, "build") ?? "").trim();
      if (!CHARACTERS[charId]) return { response: msg("ข้อมูลไม่ครบ กดลงทะเบียนใหม่อีกครั้ง") };
      if (!name) return { response: msg("ต้องใส่ชื่อตัวละคร") };
      if (!build) return { response: msg("ต้องใส่สายที่เล่น") };
      if (typeof level !== "number") return { response: msg(`เลเวลต้องเป็นตัวเลข 1–${MAX_LEVEL}`) };
      // The form came from the step-by-step message, so replace that message with the result
      return deferred(i, d, () => registerAction(d, guildId, me, { name, charId, level, build }), { update: true });
    }
    if (id === "modal:level") {
      const level = parseLevel(field(i, "level"));
      if (typeof level !== "number") return { response: msg(`เลเวลต้องเป็นตัวเลข 1–${MAX_LEVEL}`) };
      return deferred(i, d, () => levelAction(d, guildId, userId, level));
    }
  }

  return { response: msg("ปุ่มนี้เก่าแล้ว ลองกดใหม่อีกครั้ง") };
}
