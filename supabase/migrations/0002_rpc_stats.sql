-- RPC: ค่าสรุปต่อข้อต่อมิติ (SECURITY DEFINER ข้าม RLS, คืนค่าสรุปเท่านั้น)
create or replace function item_stats()
returns table (
  item_id  int,
  dim      text,
  mean     numeric,
  stddev   numeric,
  n        bigint
)
language sql
security definer
stable
as $$
  select item_id, 'completeness' as dim,
    round(avg(completeness)::numeric, 3) as mean,
    round(coalesce(stddev(completeness), 0)::numeric, 3) as stddev,
    count(*) filter (where completeness is not null) as n
  from scores group by item_id
  union all
  select item_id, 'correctness',
    round(avg(correctness)::numeric, 3),
    round(coalesce(stddev(correctness), 0)::numeric, 3),
    count(*) filter (where correctness is not null)
  from scores group by item_id
  union all
  select item_id, 'fluency',
    round(avg(fluency)::numeric, 3),
    round(coalesce(stddev(fluency), 0)::numeric, 3),
    count(*) filter (where fluency is not null)
  from scores group by item_id
  order by item_id, dim;
$$;

-- RPC: ค่าสรุปรวมทุกมิติ
create or replace function overall_stats()
returns table (
  dim           text,
  mean          numeric,
  num_raters    bigint,
  items_complete bigint
)
language sql
security definer
stable
as $$
  with rater_counts as (
    select count(distinct rater_id) as num_raters from scores
  ),
  items_complete as (
    select count(*) as cnt from (
      select item_id
      from scores
      where completeness is not null
        and correctness  is not null
        and fluency      is not null
      group by item_id
      having count(distinct rater_id) >= 1
    ) sub
  )
  select
    'completeness' as dim,
    round(avg(completeness)::numeric, 3) as mean,
    (select num_raters from rater_counts),
    (select cnt from items_complete)
  from scores
  union all
  select 'correctness',
    round(avg(correctness)::numeric, 3),
    (select num_raters from rater_counts),
    (select cnt from items_complete)
  from scores
  union all
  select 'fluency',
    round(avg(fluency)::numeric, 3),
    (select num_raters from rater_counts),
    (select cnt from items_complete)
  from scores;
$$;

-- ให้ authenticated users เรียก RPC ได้ (ไม่ได้ bypass RLS เอง — ตัว function คือ definer)
grant execute on function item_stats()    to authenticated;
grant execute on function overall_stats() to authenticated;
