create table profiles (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name  text not null,
  position   text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy profiles_own on profiles
  for all to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
