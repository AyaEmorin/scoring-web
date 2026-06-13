import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const csvPath = path.join(process.cwd(), "data", "eval.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");

  const { data, errors } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length) {
    console.error("CSV parse errors:", errors);
    process.exit(1);
  }

  const rows = data.map((row) => ({
    id: parseInt(row["# ลำดับ"].trim(), 10),
    question: row["Question"]?.trim() ?? "",
    expected_topics: row["Expected Topics"]?.trim() ?? null,
    ground_truth: row["Ground Truth"]?.trim() ?? null,
    bot_answer: row["Bot Answer"]?.trim() ?? "",
  }));

  const { error } = await supabase.from("items").upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} items successfully.`);
}

main();
