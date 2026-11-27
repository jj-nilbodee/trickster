# บอท Discord กิลด์ Trickster

ลงทะเบียนตัวละคร เปลี่ยนชื่อในเซิร์ฟเวอร์ตามชื่อตัวละคร ให้ role ตามตัวละคร (เช่น Dragon, Fox) และเก็บรายชื่อสมาชิกกิลด์

รันบน **Vercel** (ฟรี) เก็บข้อมูลใน **Supabase** (ฟรี) บอทไม่ต้องเปิดค้างไว้ Discord จะส่งคำสั่งมาที่
`https://<โปรเจกต์>.vercel.app/api/interactions` ทุกครั้งที่มีคนใช้คำสั่ง
ข้อมูลอยู่ในตาราง `members` ของ Supabase ถ้าทำหน้าเว็บกิลด์ทีหลังก็ใช้ข้อมูลชุดเดียวกันได้

## แผงปุ่ม (ไม่ต้องพิมพ์คำสั่ง)

แอดมินพิมพ์ `/panel` ในช่องที่ต้องการ (เช่น #ลงทะเบียน) ครั้งเดียว บอทจะโพสต์ข้อความที่มีปุ่มค้างไว้ถาวร
สมาชิกแค่กดปุ่ม:

- **📝 ลงทะเบียน / แก้ไข** เลือกตัวละครจากเมนู > กรอกชื่อ เลเวล และสายที่เล่นในฟอร์ม (ถ้าเคยลงไว้แล้ว ฟอร์มจะกรอกข้อมูลเดิมให้)
- **⬆️ อัปเดตเลเวล** ฟอร์มแก้เลเวล
- **👤 ข้อมูลของฉัน** และ **📋 รายชื่อกิลด์**
- **🎉 จัดปาร์ตี้** บอทส่งลิงก์ส่วนตัว (ใช้ได้ 24 ชั่วโมง) ไปหน้าเว็บ `/party` สร้างปาร์ตี้ได้หลายปาร์ตี้ ปาร์ตี้ละ 6 คน เลือกคนจากรายชื่อที่ลงทะเบียน กรองตามตัวละครหรือสายได้ ทุกคนในกิลด์เห็นและแก้ปาร์ตี้ชุดเดียวกัน กด **ประกาศใน Discord** บอทจะโพสต์ปาร์ตี้ลงช่องที่กดปุ่ม และแท็กคนในปาร์ตี้

ผลลัพธ์ทั้งหมดเห็นแค่คนที่กด ถ้าจะย้ายแผง ให้ลบข้อความเดิมแล้วใช้ `/panel` ในช่องใหม่
ใช้ `/panel` ได้เฉพาะคนที่มีสิทธิ์ Manage Server

## คำสั่ง slash (ใช้แทนปุ่มได้)

| คำสั่ง | ทำอะไร |
|---|---|
| `/register name character level build` | ลงทะเบียน (หรือแก้ข้อมูล) บอทเปลี่ยนชื่อในเซิร์ฟเวอร์เป็นชื่อตัวละคร และให้ role ตัวละคร ถ้าเปลี่ยนตัวละคร role เก่าจะถูกเอาออก |
| `/level level` | อัปเดตเลเวล |
| `/profile [member]` | ดูข้อมูลตัวเองหรือคนอื่น |
| `/roster` | รายชื่อทั้งกิลด์ แยกตามตัวละคร |
| `/party` | ลิงก์หน้าเว็บจัดปาร์ตี้ |
| `/news [mode]` | (แอดมิน) ตั้งช่องนี้ให้บอทโพสต์ข่าวใหม่จาก playtrickster.com/news (เช็กทุก 10 นาที) เลือก `ปิด` เพื่อหยุด |
| `/unregister [member]` | ลบข้อมูล เอา role ออก และคืนชื่อเดิม (ลบของคนอื่นได้ถ้ามีสิทธิ์ Manage Nicknames) |

ชื่อตัวละครซ้ำกันในเซิร์ฟเวอร์เดียวไม่ได้ หนึ่งคนลงได้หนึ่งตัวละคร (ลงใหม่ = แก้ของเดิม)
บอทสร้าง role ให้เองถ้ายังไม่มี สีตามสาย Power/Magic/Sense/Charm

## ติดตั้ง

### 1. Supabase

1. https://supabase.com > **New project** (เลือก region Singapore จะเร็วสุด)
2. **SQL Editor > New query** วางทั้งไฟล์ [`supabase/schema.sql`](supabase/schema.sql) แล้วกด **Run**
3. **Project Settings > API** คัดลอก
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (กด Reveal) → `SUPABASE_SERVICE_ROLE_KEY` ห้ามให้ใครและห้ามใส่ในหน้าเว็บ

### 2. Discord

1. https://discord.com/developers/applications > **New Application** ตั้งชื่อ
2. หน้า **General Information** คัดลอก **Application ID** → `DISCORD_APPLICATION_ID` และ **Public Key** → `DISCORD_PUBLIC_KEY`
3. หน้า **Bot** กด **Reset Token** คัดลอก → `DISCORD_BOT_TOKEN` (ห้ามให้ใคร)
4. หน้า **OAuth2 > URL Generator** ติ๊ก `bot` และ `applications.commands`
   แล้วติ๊กสิทธิ์ **Manage Roles**, **Manage Nicknames**, **View Channels**, **Send Messages**, **Embed Links** เปิดลิงก์ที่ได้ แล้วเลือกเซิร์ฟเวอร์กิลด์
5. ใน Discord: **Server Settings > Roles** ลาก role ของบอทให้อยู่ **สูงกว่า** role ตัวละครและ role ของสมาชิก

### 3. Vercel

1. https://vercel.com/new > Import repo `trickster`
2. **Root Directory** เลือก `bot` ส่วน Framework Preset เลือก **Other**
3. **Environment Variables** ใส่ 4 ตัวนี้
   `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. กด **Deploy** เสร็จแล้วเปิด `https://<โปรเจกต์>.vercel.app/api/interactions` ต้องขึ้นว่า `Trickster guild bot is running`

### 4. ต่อ Discord เข้ากับ Vercel

1. กลับไปที่ Discord Developer Portal หน้า **General Information**
2. ช่อง **Interactions Endpoint URL** ใส่ `https://<โปรเจกต์>.vercel.app/api/interactions` แล้วกด **Save**
   (Discord จะทดสอบส่งข้อความมา ถ้า save ไม่ผ่าน ให้เช็กว่า `DISCORD_PUBLIC_KEY` บน Vercel ถูก แล้ว Redeploy)

### 5. ลงทะเบียนคำสั่ง slash (ทำครั้งเดียว และทำใหม่เมื่อแก้คำสั่ง)

```bash
cd bot
npm install
DISCORD_APPLICATION_ID=xxx DISCORD_BOT_TOKEN=xxx DISCORD_GUILD_ID=<ID เซิร์ฟเวอร์> npm run register
```

ใส่ `DISCORD_GUILD_ID` แล้วคำสั่งจะขึ้นทันทีในเซิร์ฟเวอร์นั้น (คลิกขวาที่ชื่อเซิร์ฟเวอร์ > Copy Server ID
ต้องเปิด Developer Mode ใน Discord ก่อน) ถ้าไม่ใส่ คำสั่งจะใช้ได้ทุกเซิร์ฟเวอร์ แต่ครั้งแรกอาจรอถึง 1 ชม.

## ข้อจำกัด

- Discord ไม่ให้บอทเปลี่ยนชื่อ **เจ้าของเซิร์ฟเวอร์** เจ้าของต้องเปลี่ยนเอง (บอทจะแจ้งเตือน)
- Supabase แบบฟรีจะหยุดโปรเจกต์ถ้าไม่มีการใช้งานเลย 7 วัน ถ้าถูกหยุด ให้กด Restore ในหน้า Supabase (ข้อมูลไม่หาย)

## พัฒนาต่อ

```bash
cd bot
npm install
npm test          # เทสต์
npm run typecheck # เช็ก TypeScript
```

- `api/interactions.ts` จุดรับคำสั่งจาก Discord (ตรวจลายเซ็น ตอบภายใน 3 วิ แล้วทำงานช้าต่อด้วย `waitUntil`)
- `src/commands.ts` รายการคำสั่ง slash
- `src/panel.ts` แผงปุ่ม เมนู และฟอร์ม
- `src/actions.ts` การทำงานที่ทั้งสองแบบใช้ร่วมกัน
- `src/db.ts` อ่านเขียน Supabase
- `src/jobs.ts` รายชื่อตัวละครและอาชีพ (ตรงกับ `docs/data/jobs/*.json` มีเทสต์เช็กให้)
