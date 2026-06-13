# Build Spec — ระบบให้คะแนนการประเมินคำตอบแชตบอต (Human Eval)

> เอกสารนี้เป็น spec สำหรับให้ Claude Code (Sonnet) สร้างทีละ milestone
> ผู้ให้คะแนนเป็น **มนุษย์ล้วน ไม่มี LLM-as-judge** หลายคนให้คะแนนชุดเดียวกัน
> แบบอิสระ (ห้ามเห็นคะแนนคนอื่นระหว่างทำ) แล้วนำมารวมและคำนวณความสอดคล้อง

## เป้าหมาย
เว็บแอปสำหรับให้ผู้ประเมินหลายคนให้คะแนนคำตอบแชตบอต 100 ข้อ ทีละข้อตามลำดับ
ใน 3 มิติ (1–5) พร้อมช่องคำแนะนำ แล้วสรุปผลรวมทุกคนใน dashboard พร้อมตัวชี้วัด
ความสอดคล้องระหว่างผู้ให้คะแนน (inter-rater reliability)

3 มิติที่ให้คะแนน:
- `completeness` — ความครบถ้วน
- `correctness` — ความถูกต้อง
- `fluency` — ความไหลลื่นของภาษา

## Tech stack (ตายตัว)
- **Next.js (App Router) + TypeScript**
- **Supabase**: Postgres + Auth (magic link) + RLS
- **Tailwind CSS**
- **@supabase/supabase-js**, **@supabase/ssr** (auth ฝั่ง server)
- **papaparse** (อ่าน CSV ตอน seed)
- สถิติคำนวณฝั่ง server เท่านั้น

## โครงไฟล์ที่ต้องการ
```
app/
  login/page.tsx          # magic link
  page.tsx                # home: progress + resume + ลิงก์ dashboard
  score/page.tsx          # ให้คะแนนทีละข้อ
  dashboard/page.tsx      # สรุปผลรวมทุกคน
  api/stats/route.ts      # เรียก RPC สถิติ (server-only)
lib/
  supabase/client.ts      # browser client (anon)
  supabase/server.ts      # server client (cookies)
  supabase/admin.ts       # service-role client (server-only, ห้าม import ใน client)
  rubric.ts               # ข้อความ rubric 1–5 ต่อมิติ
  stats/krippendorff.ts   # คำนวณ alpha (ordinal)
components/
  ScoreCard.tsx
  DimensionRater.tsx
  ProgressGrid.tsx
  StatsPanel.tsx
supabase/
  migrations/0001_init.sql
  seed.ts
data/
  eval.csv                # ไฟล์ข้อมูล 100 ข้อ (วางไว้ที่นี่)
```

---

## ข้อมูลต้นทาง (data/eval.csv)
CSV มี 100 แถว 5 คอลัมน์ หัวคอลัมน์เป็นภาษาไทย/อังกฤษปนกัน map ดังนี้:

| คอลัมน์ใน CSV   | ฟิลด์ในตาราง       | หมายเหตุ |
|-----------------|--------------------|----------|
| `# ลำดับ`       | `id` (int)         | 1..100 มี `# ` นำหน้าชื่อคอลัมน์ |
| `Question`      | `question`         | คำถามผู้ใช้ |
| `Expected Topics`| `expected_topics` | ประเด็นที่ควรตอบ (อ้างอิง) |
| `Ground Truth`  | `ground_truth`     | สิ่งที่คำตอบควรครอบคลุม (อ้างอิง ไม่ใช่เฉลยเต็ม) |
| `Bot Answer`    | `bot_answer`       | **คำตอบที่ต้องให้คะแนน** |

---

## Milestone 1 — Schema + RLS (`supabase/migrations/0001_init.sql`)

```sql
-- 100 ข้อ
create table items (
  id int primary key,
  question text not null,
  expected_topics text,
  ground_truth text,
  bot_answer text not null
);

-- 1 แถวต่อ (ผู้ให้คะแนน × ข้อ)  -- upsert ด้วย unique key นี้
create table scores (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references auth.users(id) on delete cascade,
  item_id int not null references items(id),
  completeness smallint check (completeness between 1 and 5),
  correctness  smallint check (correctness  between 1 and 5),
  fluency      smallint check (fluency      between 1 and 5),
  comment text,
  updated_at timestamptz default now(),
  unique (rater_id, item_id)
);

alter table items  enable row level security;
alter table scores enable row level security;

-- ทุกคนที่ login อ่านชุดคำถามได้
create policy items_read on items
  for select to authenticated using (true);

-- ผู้ให้คะแนนเข้าถึงได้เฉพาะแถวของตัวเอง (กัน bias: ห้ามเห็นของคนอื่น)
create policy scores_own on scores
  for all to authenticated
  using (auth.uid() = rater_id)
  with check (auth.uid() = rater_id);
```

**สำคัญ:** dashboard ต้องรวมคะแนนทุกคน แต่ RLS ข้างบนบล็อกไม่ให้เห็นแถวคนอื่น
จึงต้องดึงค่าสรุปผ่าน **RPC แบบ SECURITY DEFINER** ที่คืน "เฉพาะค่าสรุป" (mean/sd/n/alpha)
ไม่คืนแถวรายคน → ไม่มีทางเห็นคะแนนรายบุคคลของคนอื่น (อยู่ใน Milestone 5)

---

## Milestone 2 — Seed (`supabase/seed.ts`)
สคริปต์ Node อ่าน `data/eval.csv` ด้วย papaparse แล้ว `upsert` ลงตาราง `items`
ใช้ service-role key (รันจาก terminal เท่านั้น) map คอลัมน์ตามตารางด้านบน
(ระวังชื่อคอลัมน์ `# ลำดับ` มีช่องว่าง trim ให้เรียบร้อย, แปลง id เป็น int)
เพิ่ม npm script `"seed": "tsx supabase/seed.ts"`

---

## Milestone 3 — Auth + Layout
- `/login`: Supabase magic link (กรอกอีเมล → รับลิงก์) ใช้ `@supabase/ssr`
- middleware กันหน้า `/`, `/score`, `/dashboard` ต้อง login ก่อน
- `lib/supabase/admin.ts` ใช้ `SUPABASE_SERVICE_ROLE_KEY` และต้องมี `import 'server-only'` กันหลุดไป client

Env vars:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only
```

---

## Milestone 4 — หน้าให้คะแนน (`/score`) — หัวใจของงาน

### Layout ต่อข้อ
- แถบบน: progress `ข้อ N / 100` + จำนวนที่ทำเสร็จแล้ว
- กล่องอ้างอิง (เล็ก/จาง): `Question`, `Expected Topics`, `Ground Truth`
- **กล่อง `Bot Answer` เด่นที่สุด** (อันที่กำลังให้คะแนน)
- 3 แถวให้คะแนน แต่ละแถว = ปุ่ม 1–5 + ไอคอน `?` ที่ hover แล้วโชว์ rubric (จาก `lib/rubric.ts`)
- ช่อง `comment` (textarea)
- ปุ่ม `← ก่อนหน้า` / `ถัดไป →`
- `ProgressGrid`: ตาราง 100 ช่อง คลิกกระโดดได้ + สีบอกสถานะ (ยังไม่ทำ / ทำบางส่วน / ครบ 3 มิติ)

### พฤติกรรม
- **Autosave**: ทุกครั้งที่เปลี่ยนคะแนน/คอมเมนต์ → `upsert` (debounce ~400ms) เก็บแม้ยังไม่ครบ 3 มิติ
- **บังคับคอมเมนต์เมื่อคะแนนต่ำ**: ถ้ามิติใด ≤ 2 และ `comment` ว่าง → ห้ามไปข้อถัดไป โชว์เตือน
- **ทำต่อได้**: เปิดมาให้เด้งไปข้อแรกที่ยังไม่ครบของผู้ใช้คนนั้น

### คีย์ลัด (flow เชิงเส้น เร็วสำหรับ 100×3)
- เปิดข้อ → โฟกัสมิติที่ 1 โดยอัตโนมัติ
- กด `1`–`5` → ตั้งคะแนนมิติที่โฟกัส แล้วเลื่อนโฟกัสไปมิติถัดไปเอง
- ครบ 3 มิติ → กด `Enter` หรือ `→` ไปข้อถัดไป (ถ้าติดเงื่อนไขคอมเมนต์ ให้โฟกัสช่องคอมเมนต์แทน)
- `←` ย้อนข้อก่อนหน้า
- ตัวบ่งชี้ว่าตอนนี้โฟกัสมิติไหนต้องชัด (ขอบ/ไฮไลต์)

### Rubric (`lib/rubric.ts`) — ใช้ข้อความนี้
```ts
export const RUBRIC = {
  completeness: {
    label: "ความครบถ้วน",
    desc: "คำตอบครอบคลุมประเด็นที่ Ground Truth / Expected Topics กำหนดครบไหม",
    anchors: {
      1: "ไม่ตอบประเด็น หรือตอบผิดประเด็น",
      2: "แตะประเด็น แต่ขาดสาระสำคัญเกือบหมด",
      3: "ครอบคลุมบางส่วน ขาดจุดสำคัญบางจุด",
      4: "ครอบคลุมเกือบครบ ขาดรายละเอียดเล็กน้อย",
      5: "ครบถ้วนทุกประเด็นที่ควรมี",
    },
  },
  correctness: {
    label: "ความถูกต้อง",
    desc: "ข้อมูลถูกต้องตามความจริง / Ground Truth ไหม",
    anchors: {
      1: "ผิดทั้งหมด หรือทำให้เข้าใจผิดร้ายแรง",
      2: "ผิดหลายจุด",
      3: "ถูกเป็นส่วนใหญ่ มีผิดบางจุด",
      4: "ถูกต้อง คลาดเคลื่อนเล็กน้อยไม่กระทบสาระ",
      5: "ถูกต้องทั้งหมด",
    },
  },
  fluency: {
    label: "ความไหลลื่นของภาษา",
    desc: "ภาษาเป็นธรรมชาติ อ่านเข้าใจ สุภาพ เหมาะบริบทรับสมัคร",
    anchors: {
      1: "อ่านไม่รู้เรื่อง / ผิดไวยากรณ์หนัก",
      2: "ติดขัดหลายจุด",
      3: "พออ่านได้ มีสะดุดบ้าง",
      4: "ลื่นไหลดี เป็นธรรมชาติ",
      5: "เป็นธรรมชาติมาก เหมือนคนตอบ เหมาะกับบริบท",
    },
  },
} as const;
```

---

## Milestone 5 — สถิติ (RPC + `/api/stats` + `lib/stats/krippendorff.ts`)

### RPC ใน Postgres (SECURITY DEFINER, คืนค่าสรุปเท่านั้น)
- `item_stats()` → ต่อ `item_id` ต่อมิติ: `mean`, `stddev`, `n`
- `overall_stats()` → ต่อมิติ: `mean` รวมทุกคน, จำนวนผู้ให้คะแนน, จำนวนข้อที่มีคนให้ครบ

> ใช้ SECURITY DEFINER เพื่อข้าม RLS ขณะรวมยอด แต่ฟังก์ชันต้องคืน **ค่าสรุปเท่านั้น**
> ห้ามคืน `rater_id` หรือคะแนนรายคนเด็ดขาด

### Inter-rater reliability (`lib/stats/krippendorff.ts`)
- คำนวณ **Krippendorff's alpha (ordinal)** ต่อมิติ — เพราะมี ≥3 ผู้ให้คะแนน และข้อมูลเป็น ordinal (อย่าใช้ Cohen's kappa)
- ขั้นตอนมาตรฐาน: สร้าง coincidence matrix จากคู่คะแนนภายในแต่ละข้อ → ใช้ ordinal difference function δ²(c,k) = (Σ จาก c ถึง k ของ n_g − (n_c+n_k)/2)² → `alpha = 1 − (Do/De)`
- คำนวณฝั่ง server (route handler ดึงคะแนนทั้งหมดผ่าน admin client) — ไม่ส่งคะแนนรายคนไป client
- ถ้าหา/เขียน alpha ไม่ลงตัว ให้ทำ **ICC(2,k)** หรืออย่างต่ำที่สุด **mean pairwise % agreement** เป็น fallback และ comment ไว้ว่าใช้ตัวไหน

---

## Milestone 6 — Dashboard (`/dashboard`)
- การ์ดสรุป: ค่าเฉลี่ยรวมต่อมิติ + ค่าเฉลี่ยรวมทั้งหมด + จำนวนผู้ให้คะแนน + % ความคืบหน้ารวม
- การ์ด reliability: Krippendorff's alpha ต่อมิติ (แปลผลคร่าวๆ: ≥0.8 ดีมาก, 0.67–0.8 พอใช้, <0.67 ต้องระวัง)
- กราฟการกระจายคะแนน (histogram) ต่อมิติ
- ตารางรายข้อ: เรียง/กรองได้ แสดง mean + sd ต่อมิติ — **ไฮไลต์ข้อที่ sd สูง** (ผู้ให้คะแนนเห็นไม่ตรงกัน ควร review คำถาม/rubric)
- ปุ่ม **Export** ค่าสรุปเป็น CSV/JSON
- (แนะนำ) ล็อกหน้านี้จนกว่าผู้ใช้คนนั้นจะให้คะแนนครบ 100 ข้อ เพื่อกัน bias จากการเห็นค่าเฉลี่ยระหว่างทำ — ทำเป็น flag เปิด/ปิดได้

---

## Acceptance criteria
1. ผู้ใช้ login ด้วย magic link ได้ และเห็นได้เฉพาะคะแนนของตัวเอง (ยืนยันด้วย RLS)
2. seed แล้วมี items ครบ 100 ข้อ ตรงกับ CSV
3. หน้า `/score` ให้คะแนน 3 มิติด้วยคีย์ลัด `1`–`5` + `Enter` ได้ลื่น, autosave ทำงาน, ปิดแล้วเปิดใหม่กลับมาทำต่อที่เดิม
4. คะแนนต่ำ (≤2) โดยไม่ใส่คอมเมนต์ → ถูกบล็อกไม่ให้ข้ามข้อ
5. dashboard แสดงค่าเฉลี่ยรวมทุกคน + Krippendorff alpha ต่อมิติ + ไฮไลต์ข้อ sd สูง + export ได้
6. ไม่มี endpoint/หน้าไหนที่ผู้ให้คะแนนเห็นคะแนนรายบุคคลของคนอื่นได้

## ลำดับการทำ
ทำตาม Milestone 1 → 6 ตามลำดับ commit แยกแต่ละ milestone และรัน build/lint ผ่านก่อนไปต่อ
```
