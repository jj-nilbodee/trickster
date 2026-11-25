# บอท Discord กิลด์ Trickster

ลงทะเบียนตัวละคร เปลี่ยนชื่อในเซิร์ฟเวอร์ตามชื่อตัวละคร ให้ role อาชีพ และเก็บข้อมูลไว้หาคนจัดปาร์ตี้

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `/register name character job level` | ลงทะเบียน (หรือแก้ข้อมูล) บอทเปลี่ยนชื่อเล่นเป็นชื่อตัวละคร และให้ role อาชีพ ถ้าเปลี่ยนอาชีพ role เก่าจะถูกเอาออก |
| `/level level` | อัปเดตเลเวล |
| `/profile [member]` | ดูข้อมูลตัวเองหรือคนอื่น |
| `/party [character] [job] [min_level] [max_level] [show_all]` | หาสมาชิกตามตัวละคร อาชีพ หรือช่วงเลเวล ใส่ `show_all: True` ให้ทั้งห้องเห็น |
| `/roster` | รายชื่อทั้งกิลด์ แยกตามตัวละคร |
| `/unregister [member]` | ลบข้อมูล เอา role ออก และคืนชื่อเดิม (ลบของคนอื่นได้ถ้ามีสิทธิ์ Manage Nicknames) |

ชื่อตัวละครซ้ำกันในเซิร์ฟเวอร์เดียวไม่ได้ หนึ่งคนลงได้หนึ่งตัวละคร (ลงใหม่ = แก้ของเดิม)

## ตั้งค่า (ตัวแปร environment)

| ตัวแปร | ค่า |
|---|---|
| `DISCORD_TOKEN` | Bot token (จำเป็น) |
| `ROLE_MODE` | `character` (ค่าเริ่มต้น: role เป็นชื่อตัวละคร เช่น Dragon, Fox) หรือ `job` (role เป็นชื่ออาชีพ เช่น Priest, Dark Lord) |
| `DB_PATH` | ที่เก็บไฟล์ฐานข้อมูล (ค่าเริ่มต้น `guild.db`, ใน Docker คือ `/data/guild.db`) |
| `GUILD_ID` | ใส่ ID เซิร์ฟเวอร์ ถ้าอยากให้คำสั่งขึ้นทันที (ไม่ใส่ก็ได้ แต่ครั้งแรกอาจรอถึง 1 ชม.) |

บอทสร้าง role อาชีพให้เองถ้ายังไม่มี สีตามสาย Power/Magic/Sense/Charm

## 1. สร้างบอทใน Discord

1. ไปที่ https://discord.com/developers/applications กด **New Application** ตั้งชื่อ
2. เมนู **Bot** กด **Reset Token** แล้วคัดลอกเก็บไว้ (นี่คือ `DISCORD_TOKEN` ห้ามให้ใคร)
3. เมนู **OAuth2 > URL Generator** ติ๊ก `bot` และ `applications.commands`
   แล้วติ๊กสิทธิ์ **Manage Roles**, **Manage Nicknames**, **Send Messages**
4. เปิดลิงก์ที่ได้ แล้วเลือกเซิร์ฟเวอร์กิลด์
5. ใน **Server Settings > Roles** ลาก role ของบอทให้อยู่ **สูงกว่า** role อาชีพและ role ของสมาชิก
   ไม่งั้นบอทจะเปลี่ยนชื่อหรือให้ role ไม่ได้

ข้อจำกัดของ Discord: บอทเปลี่ยนชื่อ **เจ้าของเซิร์ฟเวอร์** ไม่ได้ เจ้าของต้องเปลี่ยนเอง

## 2. รันบน Railway

1. https://railway.com > **New Project > Deploy from GitHub repo** เลือก repo `trickster`
2. ใน **Settings** ของ service ตั้ง **Root Directory** เป็น `bot` (Railway จะใช้ `Dockerfile` ในโฟลเดอร์นี้)
3. **Variables** เพิ่ม `DISCORD_TOKEN`
4. คลิกขวาที่ service > **Attach Volume** ตั้ง mount path เป็น `/data`
   (ถ้าไม่ใส่ volume ข้อมูลที่ลงทะเบียนจะหายทุกครั้งที่ deploy ใหม่)
5. รอ deploy เสร็จ ใน Logs จะขึ้น `Logged in as ...`

## รันบนเครื่องตัวเอง

```bash
cd bot
pip install -r requirements.txt
DISCORD_TOKEN=xxxx python bot.py
```

## ทดสอบ

```bash
cd bot
pip install pytest
python -m pytest tests
```
