import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/requireProfile";
import { getIsAdmin } from "@/lib/getAdminStatus";
import Link from "next/link";

export default async function HomePage() {
  const { user, profile } = await requireProfile();
  const isAdmin = await getIsAdmin(user.email!);

  async function handleSignOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  const header = (
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-2xl font-bold">Human Eval</h1>
        <p className="text-sm text-gray-800 font-medium mt-0.5">
          {profile.first_name} {profile.last_name}
        </p>
        <p className="text-xs text-gray-400">{profile.position}</p>
      </div>
      <form action={handleSignOut}>
        <button className="text-sm text-gray-400 hover:text-gray-600">ออกจากระบบ</button>
      </form>
    </div>
  );

  // ---- Admin view ----
  if (isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6">
          {header}
          <p className="text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
            บัญชีผู้ดูแลระบบ — ไม่ต้องทำแบบประเมิน
          </p>
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg text-center transition-colors"
          >
            Dashboard ผลรวม
          </Link>
        </div>
      </div>
    );
  }

  // ---- Rater view ----
  const supabase = await createClient();
  const { data: scores } = await supabase
    .from("scores")
    .select("item_id, completeness, correctness, fluency")
    .eq("rater_id", user.id);

  const done = scores?.filter(
    (s) => s.completeness && s.correctness && s.fluency
  ).length ?? 0;
  const inProgress = (scores?.length ?? 0) - done;

  const doneSet = new Set(
    scores
      ?.filter((s) => s.completeness && s.correctness && s.fluency)
      .map((s) => s.item_id)
  );
  const firstIncomplete = Array.from({ length: 100 }, (_, i) => i + 1).find(
    (id) => !doneSet.has(id)
  ) ?? 1;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8 space-y-6">
        {header}

        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">ความคืบหน้า</span>
            <span className="font-medium">{done} / 100 ข้อ</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${done}%` }}
            />
          </div>
          {inProgress > 0 && (
            <p className="text-xs text-amber-600">{inProgress} ข้อที่ยังให้คะแนนไม่ครบ 3 มิติ</p>
          )}
        </div>

        <Link
          href={`/score?item=${firstIncomplete}`}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg text-center transition-colors"
        >
          {done === 0 ? "เริ่มให้คะแนน" : done === 100 ? "ตรวจสอบคำตอบ" : `ทำต่อ (ข้อ ${firstIncomplete})`}
        </Link>
      </div>
    </div>
  );
}
