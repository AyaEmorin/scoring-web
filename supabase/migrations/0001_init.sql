-- 100 ข้อที่ต้องให้คะแนน
create table items (
  id int primary key,
  question text not null,
  expected_topics text,
  ground_truth text,
  bot_answer text not null
);

-- 1 แถวต่อ (ผู้ให้คะแนน × ข้อ) — upsert ด้วย unique(rater_id, item_id)
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
