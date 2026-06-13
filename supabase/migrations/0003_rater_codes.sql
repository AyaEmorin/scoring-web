create table rater_codes (
  code text primary key,
  rater_name text not null,
  email text not null unique,
  created_at timestamptz default now()
);

-- ไม่มี policy = เฉพาะ service role เท่านั้นที่อ่าน/เขียนได้ (ผ่าน admin client)
alter table rater_codes enable row level security;
