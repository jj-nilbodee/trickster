# บอท Discord กิลด์ Trickster

ลงทะเบียนตัวละคร เปลี่ยนชื่อในเซิร์ฟเวอร์ตามชื่อตัวละคร ให้ role อาชีพ และเก็บข้อมูลไว้หาคนจัดปาร์ตี้

รันบน **Vercel** (ฟรี) เก็บข้อมูลใน **Supabase** (ฟรี) บอทไม่ต้องเปิดค้างไว้ Discord จะส่งคำสั่งมาที่
`https://<โปรเจกต์>.vercel.app/api/interactions` ทุกครั้งที่มีคนใช้คำสั่ง
ข้อมูลอยู่ในตาราง `members` ของ Supabase ถ้าทำหน้าเว็บกิลด์ทีหลังก็ใช้ข้อมูลชุดเดียวกันได้

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `/register name character job level` | ลงทะเบียน (หรือแก้ข้อมูล) บอทเปลี่ยนชื่อในเซิร์ฟเวอร์เป็นชื่อตัวละคร และให้ role อาชีพ ถ้าเปลี่ยนอาชีพ role เก่าจะถูกเอาออก |
| `/level level` | อัปเดตเลเวล |
| `/profile [member]` | ดูข้อมูลตัวเองหรือคนอื่น |
| `/party [character] [job] [min_level] [max_level] [show_all]` | หาสมาชิกตามตัวละคร อาชีพ หรือช่วงเลเวล ใส่ `show_all: True` ให้ทั้งห้องเห็น |
| `/roster` | รายชื่อทั้งกิลด์ แยกตามตัวละคร |
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
   แล้วติ๊กสิทธิ์ **Manage Roles** และ **Manage Nicknames** เปิดลิงก์ที่ได้ แล้วเลือกเซิร์ฟเวอร์กิลด์
5. ใน Discord: **Server Settings > Roles** ลาก role ของบอทให้อยู่ **สูงกว่า** role อาชีพและ role ของสมาชิก

### 3. Vercel

1. https://vercel.com/new > Import repo `trickster`
2. **Root Directory** เลือก `bot` ส่วน Framework Preset เลือก **Other**
3. **Environment Variables** ใส่ 4 ตัวนี้
   `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (ไม่บังคับ: `ROLE_MODE=job` ถ้าอยากให้ role เป็นชื่ออาชีพ เช่น Priest แทนชื่อตัวละคร เช่น Dragon)
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
- `src/commands.ts` รายการคำสั่งและการทำงาน
- `src/db.ts` อ่านเขียน Supabase
- `src/jobs.ts` รายชื่อตัวละครและอาชีพ (ตรงกับ `docs/data/jobs/*.json` มีเทสต์เช็กให้)
