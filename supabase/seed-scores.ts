/**
 * Seed scores for a rater by code.
 * Usage: tsx --env-file=.env.local supabase/seed-scores.ts <RATER_CODE>
 * Scores are random integers 3–5 per dimension (realistic "decent" range).
 */

import { createClient } from "@supabase/supabase-js";

function randScore(): number {
  return Math.floor(Math.random() * 3) + 3; // 3–5, เฉลี่ย ~4.0
}

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error("Usage: tsx --env-file=.env.local supabase/seed-scores.ts <RATER_CODE>");
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. หา email จาก rater_codes
  const { data: raterCode, error: codeErr } = await admin
    .from("rater_codes")
    .select("email, rater_name")
    .eq("code", code)
    .single();

  if (codeErr || !raterCode) {
    console.error(`❌ ไม่พบ rater code: ${code}`);
    process.exit(1);
  }

  console.log(`ผู้ให้คะแนน: ${raterCode.rater_name} (${raterCode.email})`);

  // 2. หา user ID จาก auth
  const { data: { users }, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) {
    console.error("❌ ไม่สามารถดึงรายการ users:", usersErr.message);
    process.exit(1);
  }

  const user = users.find((u) => u.email === raterCode.email);
  if (!user) {
    console.error(`❌ ไม่พบ auth user สำหรับ email: ${raterCode.email}`);
    process.exit(1);
  }

  console.log(`User ID: ${user.id}`);

  // 3. สร้าง scores 100 ข้อ
  const rows = Array.from({ length: 100 }, (_, i) => ({
    rater_id: user.id,
    item_id: i + 1,
    completeness: randScore(),
    correctness: randScore(),
    fluency: randScore(),
    comment: null,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await admin
    .from("scores")
    .upsert(rows, { onConflict: "rater_id,item_id" });

  if (upsertErr) {
    console.error("❌ Upsert ล้มเหลว:", upsertErr.message);
    process.exit(1);
  }

  console.log(`✅ Seeded 100 × 3 scores for ${raterCode.rater_name} เรียบร้อย`);
}

main();
