// The button panel: a permanent message with buttons, posted by an admin with /panel.
// Buttons open menus and forms so members don't need to type slash commands.
import { CHARACTERS, MAX_LEVEL, STAT_EMOJI, allJobs, findJob } from "./jobs.js";
import type { Filters, Member } from "./db.js";
import {
  deferred,
  levelAction,
  msg,
  partyAction,
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
          "**📝 ลงทะเบียน / แก้ไข** เลือกตัวละครกับอาชีพ แล้วกรอกชื่อและเลเวล บอทจะเปลี่ยนชื่อในเซิร์ฟเวอร์เป็นชื่อตัวละคร และให้ role อาชีพ",
          "**⬆️ อัปเดตเลเวล** แก้เลเวลอย่างเดียว",
          "**🔍 หาปาร์ตี้** ค้นสมาชิกตามตัวละคร อาชีพ หรือช่วงเลเวล",
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
          { type: BUTTON, style: PRIMARY, label: "หาปาร์ตี้", emoji: { name: "🔍" }, custom_id: "panel:party" },
          { type: BUTTON, style: SECONDARY, label: "รายชื่อกิลด์", emoji: { name: "📋" }, custom_id: "panel:roster" },
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
const updateMessage = (content: string, components: object[]) => ({
  type: ResponseType.UPDATE_MESSAGE,
  data: { content, components },
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
          description: `สาย ${c.stat} · ${c.jobs.join(", ")}`.slice(0, 100),
          value: id,
          emoji: { name: STAT_EMOJI[c.stat] },
        })),
      },
    ],
  };
}

function jobSelect(charId: string) {
  return {
    type: ACTION_ROW,
    components: [
      {
        type: STRING_SELECT,
        custom_id: `reg:job:${charId}`,
        placeholder: "เลือกอาชีพตอนนี้",
        options: CHARACTERS[charId].jobs.map((j, idx) => ({
          label: j,
          description: idx === 0 ? "อาชีพขั้น 1" : idx === 1 ? "อาชีพขั้น 2" : "อาชีพขั้น 3",
          value: j,
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

/** "Dragon" -> { charId: dragon }, "priest" -> { job: Priest }. */
function parseCharOrJob(text: string | undefined): Filters | "bad" {
  const t = (text ?? "").trim().toLowerCase();
  if (!t) return {};
  const char = Object.entries(CHARACTERS).find(([, c]) => c.name.toLowerCase() === t);
  if (char) return { charId: char[0] };
  const job = allJobs().find(([, j]) => j.toLowerCase() === t);
  if (job) return { job: job[1] };
  return "bad";
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
        return { response: ephemeralMessage("**ขั้นที่ 1/3** เลือกตัวละคร", [characterSelect("reg:char", "เลือกตัวละคร")]) };
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
      case "panel:party":
        return {
          response: {
            type: ResponseType.MODAL,
            data: {
              custom_id: "modal:party",
              title: "หาปาร์ตี้",
              components: [
                textInput("who", "ตัวละครหรืออาชีพ (ว่างไว้ = ทุกคน)", { required: false, placeholder: "เช่น Dragon หรือ Priest" }),
                textInput("min", "เลเวลต่ำสุด (ว่างไว้ได้)", { required: false, max: 3 }),
                textInput("max", "เลเวลสูงสุด (ว่างไว้ได้)", { required: false, max: 3 }),
              ],
            },
          },
        };
      case "panel:roster":
        return deferred(i, d, () => rosterAction(d, guildId));
      case "reg:char": {
        const charId = i.data?.values?.[0] ?? "";
        if (!CHARACTERS[charId]) return { response: msg("เลือกตัวละครใหม่อีกครั้ง") };
        return {
          response: updateMessage(`**ขั้นที่ 2/3** ${CHARACTERS[charId].name}: เลือกอาชีพ`, [
            jobSelect(charId),
            characterSelect("reg:char", "เปลี่ยนตัวละคร"),
          ]),
        };
      }
    }
    if (id.startsWith("reg:job:")) {
      const charId = id.slice("reg:job:".length);
      const job = findJob(charId, i.data?.values?.[0] ?? "");
      if (!job) return { response: msg("เลือกอาชีพใหม่อีกครั้ง") };
      const m = await quickGet(d, guildId, userId);
      return {
        response: {
          type: ResponseType.MODAL,
          data: {
            custom_id: `modal:reg:${charId}:${job}`,
            title: `ขั้นที่ 3/3 ${CHARACTERS[charId].name} ${job}`.slice(0, 45),
            components: [
              textInput("name", "ชื่อตัวละครในเกม", { value: m?.name }),
              textInput("level", "เลเวลตอนนี้", { max: 3, value: m ? String(m.level) : undefined }),
            ],
          },
        },
      };
    }
  }

  if (i.type === InteractionType.MODAL_SUBMIT) {
    if (id.startsWith("modal:reg:")) {
      const [charId, job] = id.slice("modal:reg:".length).split(":");
      const name = (field(i, "name") ?? "").trim();
      const level = parseLevel(field(i, "level"));
      if (!CHARACTERS[charId] || !findJob(charId, job ?? "")) return { response: msg("ข้อมูลไม่ครบ กดลงทะเบียนใหม่อีกครั้ง") };
      if (!name) return { response: msg("ต้องใส่ชื่อตัวละคร") };
      if (typeof level !== "number") return { response: msg(`เลเวลต้องเป็นตัวเลข 1–${MAX_LEVEL}`) };
      // The form came from the step-by-step message, so replace that message with the result
      return deferred(i, d, () => registerAction(d, guildId, me, { name, charId, job, level }), { update: true });
    }
    if (id === "modal:level") {
      const level = parseLevel(field(i, "level"));
      if (typeof level !== "number") return { response: msg(`เลเวลต้องเป็นตัวเลข 1–${MAX_LEVEL}`) };
      return deferred(i, d, () => levelAction(d, guildId, userId, level));
    }
    if (id === "modal:party") {
      const who = parseCharOrJob(field(i, "who"));
      const minLevel = parseLevel(field(i, "min"));
      const maxLevel = parseLevel(field(i, "max"));
      if (who === "bad") return { response: msg("ไม่รู้จักตัวละครหรืออาชีพนี้ ลองพิมพ์เช่น Dragon, Fox, Priest, Dark Lord") };
      if (minLevel === "bad" || maxLevel === "bad") return { response: msg(`เลเวลต้องเป็นตัวเลข 1–${MAX_LEVEL}`) };
      return deferred(i, d, () => partyAction(d, guildId, { ...who, minLevel, maxLevel }));
    }
  }

  return { response: msg("ปุ่มนี้เก่าแล้ว ลองกดใหม่อีกครั้ง") };
}
