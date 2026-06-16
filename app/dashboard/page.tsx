import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { krippendorffAlphaOrdinal } from "@/lib/stats/krippendorff";
import { DIMENSIONS, type Dimension } from "@/lib/rubric";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

interface RawScore {
  rater_id: string;
  item_id: number;
  completeness: number | null;
  correctness: number | null;
  fluency: number | null;
  comment: string | null;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getAdminClient();
  const { data: raterProfile } = await admin
    .from("rater_codes")
    .select("is_admin")
    .eq("email", user.email!)
    .single() as { data: { is_admin: boolean } | null };

  if (!raterProfile?.is_admin) redirect("/");

  const [
    { data: allProfilesRaw },
    { data: allScoresRaw },
    { data: overall },
    { data: perItem },
    { data: nonAdminCodesRaw },
    { data: { users: authUsers } },
  ] = await Promise.all([
    admin.from("profiles").select("user_id, first_name, last_name, position"),
    admin.from("scores").select("rater_id, item_id, completeness, correctness, fluency, comment"),
    admin.rpc("overall_stats"),
    admin.rpc("item_stats"),
    admin.from("rater_codes").select("email").eq("is_admin", false),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  // กรองเฉพาะ user ที่ไม่ใช่ admin
  const nonAdminEmails = new Set((nonAdminCodesRaw ?? []).map((r: { email: string }) => r.email));
  const nonAdminUserIds = new Set(
    authUsers
      .filter((u) => u.email && nonAdminEmails.has(u.email))
      .map((u) => u.id)
  );

  const allProfiles = ((allProfilesRaw ?? []) as Profile[]).filter((p) =>
    nonAdminUserIds.has(p.user_id)
  );
  const allScores = (allScoresRaw ?? []) as RawScore[];

  // คำนวณ Krippendorff alpha
  const alpha: Record<Dimension, number | null> = {
    completeness: null, correctness: null, fluency: null,
  };
  const raterIds = Array.from(new Set(allScores.map((r) => r.rater_id)));
  if (raterIds.length >= 2) {
    for (const dim of DIMENSIONS) {
      const matrix = raterIds.map((rid) =>
        Array.from({ length: 100 }, (_, i) => {
          const row = allScores.find((r) => r.rater_id === rid && r.item_id === i + 1);
          return row ? (row[dim] ?? null) : null;
        })
      );
      alpha[dim] = krippendorffAlphaOrdinal(matrix);
    }
  }

  // สรุปรายคน
  const raterSummary = allProfiles.map((p) => {
    const rs = allScores.filter((s) => s.rater_id === p.user_id);
    const done = rs.filter((s) => s.completeness && s.correctness && s.fluency).length;
    const mean = (dim: Dimension) => {
      const vals = rs.map((s) => s[dim]).filter((v): v is number => v !== null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      user_id: p.user_id,
      name: `${p.first_name} ${p.last_name}`,
      position: p.position,
      done,
      mean_completeness: mean("completeness"),
      mean_correctness: mean("correctness"),
      mean_fluency: mean("fluency"),
    };
  });

  return (
    <DashboardClient
      overall={overall ?? []}
      perItem={perItem ?? []}
      alpha={alpha}
      raterSummary={raterSummary}
      rawScores={allScores}
    />
  );
}
