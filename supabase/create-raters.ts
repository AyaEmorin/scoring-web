/**
 * สร้างบัญชีผู้ให้คะแนนและพิมพ์รหัสลับสำหรับแจก
 * วิธีใช้: tsx --env-file=.env.local supabase/create-raters.ts [--admin] "ชื่อ1" "ชื่อ2" ...
 *
 * ตัวอย่าง (ผู้ให้คะแนนทั่วไป):
 *   tsx --env-file=.env.local supabase/create-raters.ts "สมชาย" "สมหญิง"
 *
 * ตัวอย่าง (admin — เห็น dashboard):
 *   tsx --env-file=.env.local supabase/create-raters.ts --admin "ผู้ดูแล"
 */

import { createClient } from "@supabase/supabase-js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ตัดอักษรที่อ่านสับสน (O,I,L,0,1)

function generateCode(length = 8): string {
  return Array.from({ length }, () =>
    ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  ).join("");
}

function nameToEmailSlug(name: string): string {
  // แปลงชื่อไทยเป็น slug ง่ายๆ
  return `rater_${Buffer.from(name).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase()}`;
}

async function main() {
  const args = process.argv.slice(2);
  const isAdmin = args.includes("--admin");
  const names = args.filter((a) => a !== "--admin");

  if (names.length === 0) {
    console.error('กรุณาใส่ชื่อผู้ให้คะแนน เช่น: tsx --env-file=.env.local supabase/create-raters.ts "สมชาย" "สมหญิง"');
    process.exit(1);
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log("\nสร้างบัญชีผู้ให้คะแนน...\n");
  const results: { name: string; code: string }[] = [];

  for (const name of names) {
    const code = generateCode();
    const email = `${nameToEmailSlug(name)}_${Date.now()}@eval.internal`;

    // สร้าง Supabase auth user
    const { data: userResult, error: createError } = await admin.auth.admin.createUser({
      email,
      password: code,
      email_confirm: true, // ข้ามขั้นตอน confirm email
    });

    if (createError) {
      console.error(`❌ ${name}: ${createError.message}`);
      continue;
    }

    // บันทึกลงตาราง rater_codes
    const { error: insertError } = await admin.from("rater_codes").insert({
      code,
      rater_name: name,
      email,
      is_admin: isAdmin,
    });

    if (insertError) {
      console.error(`❌ ${name}: ${insertError.message}`);
      // rollback user
      await admin.auth.admin.deleteUser(userResult.user.id);
      continue;
    }

    results.push({ name, code });
    console.log(`✅ ${name}`);
  }

  if (results.length > 0) {
    console.log("\n" + "─".repeat(40));
    console.log("รหัสลับสำหรับแจกให้ผู้ให้คะแนน:");
    console.log("─".repeat(40));
    results.forEach(({ name, code }) => {
      console.log(`${name.padEnd(20)} ${code}`);
    });
    console.log("─".repeat(40));
    console.log("⚠️  บันทึกรหัสเหล่านี้ไว้ จะไม่สามารถดูได้อีก\n");
  }
}

main();
