import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RUBRIC, DIMENSIONS } from "@/lib/rubric";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ raterId: string }>;
}

export default async function RaterDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminClient();
  const { data: adminCheck } = await admin
    .from("rater_codes")
    .select("is_admin")
    .eq("email", user.email!)
    .single() as { data: { is_admin: boolean } | null };

  if (!adminCheck?.is_admin) redirect("/");

  const { raterId } = await params;

  const [{ data: profileRaw }, { data: scoresRaw }, { data: itemsRaw }] = await Promise.all([
    admin.from("profiles").select("first_name, last_name, position").eq("user_id", raterId).single(),
    admin.from("scores").select("item_id, completeness, correctness, fluency, comment").eq("rater_id", raterId),
    admin.from("items").select("id, question, bot_answer").order("id"),
  ]);

  const profile = profileRaw as { first_name: string; last_name: string; position: string } | null;
  const scores = (scoresRaw ?? []) as { item_id: number; completeness: number | null; correctness: number | null; fluency: number | null; comment: string | null }[];
  const items = (itemsRaw ?? []) as { id: number; question: string; bot_answer: string }[];

  if (!profile) redirect("/dashboard");

  const done = scores.filter((s) => s.completeness && s.correctness && s.fluency).length;

  const scoreMap = new Map(scores.map((s) => [s.item_id, s]));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <div>
            <span className="font-bold">{profile.first_name} {profile.last_name}</span>
            <span className="text-gray-400 text-sm ml-2">{profile.position}</span>
            <span className={`ml-3 text-xs font-medium px-2 py-0.5 rounded-full ${
              done === 100 ? "bg-green-100 text-green-700" :
              done > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
            }`}>
              {done} / 100 ข้อ
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-3 py-2 text-left w-10">ข้อ</th>
                <th className="px-3 py-2 text-left">คำถาม</th>
                {DIMENSIONS.map((d) => (
                  <th key={d} className="px-3 py-2 text-center w-20">{RUBRIC[d].label}</th>
                ))}
                <th className="px-3 py-2 text-left">คำแนะนำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const s = scoreMap.get(item.id);
                const complete = s?.completeness && s?.correctness && s?.fluency;
                return (
                  <tr key={item.id} className={`hover:bg-gray-50 ${!s ? "opacity-40" : ""}`}>
                    <td className="px-3 py-2 font-medium text-gray-500">{item.id}</td>
                    <td className="px-3 py-2 max-w-xs">
                      <p className="truncate text-gray-800">{item.question}</p>
                    </td>
                    {DIMENSIONS.map((d) => {
                      const val = s?.[d] ?? null;
                      return (
                        <td key={d} className="px-3 py-2 text-center">
                          {val !== null ? (
                            <span className={`inline-block w-7 h-7 rounded-full text-xs font-bold leading-7 ${
                              val <= 2 ? "bg-red-100 text-red-700" :
                              val === 3 ? "bg-amber-100 text-amber-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {val}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">
                      <p className="truncate">{s?.comment ?? ""}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
