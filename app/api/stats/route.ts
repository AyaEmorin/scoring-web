import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { krippendorffAlphaOrdinal } from "@/lib/stats/krippendorff";
import { DIMENSIONS, type Dimension } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  interface RawScore {
    rater_id: string;
    item_id: number;
    completeness: number | null;
    correctness: number | null;
    fluency: number | null;
  }

  const admin = getAdminClient();
  const [{ data: overall }, { data: perItem }, { data: rawScoresRaw }] = await Promise.all([
    admin.rpc("overall_stats"),
    admin.rpc("item_stats"),
    admin.from("scores").select("rater_id, item_id, completeness, correctness, fluency"),
  ]);
  const rawScores = rawScoresRaw as RawScore[] | null;

  const alpha: Record<Dimension, number | null> = {
    completeness: null,
    correctness: null,
    fluency: null,
  };

  if (rawScores && rawScores.length > 0) {
    const raterIds = Array.from(new Set(rawScores.map((r) => r.rater_id)));

    if (raterIds.length >= 2) {
      for (const dim of DIMENSIONS) {
        const matrix: (number | null)[][] = raterIds.map((rid) =>
          Array.from({ length: 100 }, (_, i) => {
            const row = rawScores.find(
              (r) => r.rater_id === rid && r.item_id === i + 1
            );
            return row ? (row[dim] ?? null) : null;
          })
        );
        alpha[dim] = krippendorffAlphaOrdinal(matrix);
      }
    }
  }

  return NextResponse.json({ overall, perItem, alpha });
}
