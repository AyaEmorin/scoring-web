"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import StatsPanel from "@/components/StatsPanel";
import { RUBRIC, DIMENSIONS, type Dimension } from "@/lib/rubric";

interface OverallStat {
  dim: string;
  mean: number | null;
  num_raters: number;
  items_complete: number;
}

interface PerItemStat {
  item_id: number;
  dim: string;
  mean: number | null;
  stddev: number | null;
  n: number;
}

interface Alpha {
  completeness: number | null;
  correctness: number | null;
  fluency: number | null;
}

interface RawScore {
  rater_id: string;
  item_id: number;
  completeness: number | null;
  correctness: number | null;
  fluency: number | null;
  comment: string | null;
}

interface RaterSummary {
  user_id: string;
  name: string;
  position: string;
  done: number;
  mean_completeness: number | null;
  mean_correctness: number | null;
  mean_fluency: number | null;
}

interface Props {
  overall: OverallStat[];
  perItem: PerItemStat[];
  alpha: Alpha;
  raterSummary: RaterSummary[];
  rawScores: RawScore[];
}

const SD_HIGH_THRESHOLD = 1.2;

const MEAN_KEY: Record<Dimension, keyof Pick<RaterSummary, "mean_completeness" | "mean_correctness" | "mean_fluency">> = {
  completeness: "mean_completeness",
  correctness: "mean_correctness",
  fluency: "mean_fluency",
};

function interpretMean(mean: number): string {
  if (mean >= 4.21) return "ดีมาก";
  if (mean >= 3.41) return "ดี";
  if (mean >= 2.61) return "ปานกลาง";
  if (mean >= 1.81) return "พอใช้";
  return "ควรปรับปรุง";
}

function sampleSD(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function alphaInterp(a: number | null): string {
  if (a === null) return "ไม่มีข้อมูลเพียงพอ (ต้องการ ≥2 คน)";
  if (a >= 0.8) return "ดีมาก — ความเห็นสอดคล้องกันสูง";
  if (a >= 0.67) return "พอใช้ — ความเห็นสอดคล้องในระดับที่ยอมรับได้";
  return "ต้องระวัง — ความเห็นไม่สอดคล้องกัน ควรทบทวน rubric";
}

type Tab = "raters" | "items" | "stats";

export default function DashboardClient({ overall, perItem, alpha, raterSummary, rawScores }: Props) {
  const [tab, setTab] = useState<Tab>("raters");
  const [sortBy, setSortBy] = useState<"id" | "sd">("id");

  const itemIds = Array.from(new Set(perItem.map((r) => r.item_id))).sort((a, b) => a - b);
  const rows = itemIds.map((id) => {
    const stats = Object.fromEntries(
      DIMENSIONS.map((dim) => [dim, perItem.find((r) => r.item_id === id && r.dim === dim) ?? null])
    ) as Record<Dimension, PerItemStat | null>;
    const maxSd = Math.max(...DIMENSIONS.map((d) => Number(stats[d]?.stddev ?? 0)));
    return { id, stats, maxSd };
  });
  const sorted = [...rows].sort((a, b) => sortBy === "sd" ? b.maxSd - a.maxSd : a.id - b.id);

  const exportCSV = useCallback(() => {
    const headers = ["item_id", ...DIMENSIONS.flatMap((d) => [`${d}_mean`, `${d}_sd`, `${d}_n`])];
    const lines = rows.map(({ id, stats }) =>
      [id, ...DIMENSIONS.flatMap((d) => [stats[d]?.mean ?? "", stats[d]?.stddev ?? "", stats[d]?.n ?? ""])].join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "eval_stats.csv"; a.click();
  }, [rows]);

  const exportAI = useCallback(() => {
    // คำนวณ mean/SD จากค่าเฉลี่ยรายบุคคลต่อมิติ (sample SD, n−1)
    const dimStats = DIMENSIONS.map((dim) => {
      const vals = raterSummary.map((r) => r[MEAN_KEY[dim]]).filter((v): v is number => v !== null);
      const mean = vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const sd = vals.length >= 2 ? sampleSD(vals) : null;
      return { dim, mean, sd, n: vals.length };
    });
    const dimMeans = dimStats.map((s) => s.mean).filter((v): v is number => v !== null);
    const overallMean = dimMeans.length === DIMENSIONS.length
      ? dimMeans.reduce((a, b) => a + b, 0) / dimMeans.length
      : null;

    const highSdItems = rows
      .filter((r) => r.maxSd >= SD_HIGH_THRESHOLD)
      .map(({ id, stats }) => ({
        item_id: id,
        ...Object.fromEntries(DIMENSIONS.flatMap((d) => [
          [`${d}_mean`, stats[d]?.mean != null ? +Number(stats[d]!.mean).toFixed(2) : null],
          [`${d}_sd`,   stats[d]?.stddev != null ? +Number(stats[d]!.stddev).toFixed(2) : null],
        ])),
      }));

    const output = {
      metadata: {
        title: "ผลการประเมินคุณภาพคำตอบแชตบอตโดยผู้เชี่ยวชาญ (Human Evaluation)",
        export_date: new Date().toISOString().slice(0, 10),
        num_raters: raterSummary.length,
        num_items: 100,
        rating_scale: "1–5 (1=ควรปรับปรุง, 2=พอใช้, 3=ปานกลาง, 4=ดี, 5=ดีมาก)",
        dimensions: DIMENSIONS.map((d) => ({ key: d, label: RUBRIC[d].label, description: RUBRIC[d].desc })),
      },

      summary: {
        overall_mean: overallMean != null ? +overallMean.toFixed(2) : null,
        overall_interpretation: overallMean != null ? interpretMean(overallMean) : null,
        by_dimension: Object.fromEntries(dimStats.map(({ dim, mean, sd, n }) => [dim, {
          label: RUBRIC[dim].label,
          mean: mean != null ? +mean.toFixed(2) : null,
          sd:   sd   != null ? +sd.toFixed(2)   : null,
          n_raters_with_data: n,
          interpretation: mean != null ? interpretMean(mean) : "รอข้อมูล",
        }])),
      },

      inter_rater_reliability: {
        method: "Krippendorff's Alpha (ordinal)",
        interpretation_guide: "≥0.8 ดีมาก · 0.67–0.8 พอใช้ · <0.67 ต้องระวัง",
        by_dimension: Object.fromEntries(DIMENSIONS.map((dim) => [dim, {
          label: RUBRIC[dim].label,
          alpha: alpha[dim] != null ? +alpha[dim]!.toFixed(3) : null,
          interpretation: alphaInterp(alpha[dim]),
        }])),
      },

      raters: raterSummary.map((r) => ({
        name: r.name,
        position: r.position,
        items_completed: r.done,
        completion_pct: +(r.done / 100 * 100).toFixed(1),
        mean_completeness: r.mean_completeness != null ? +r.mean_completeness.toFixed(2) : null,
        mean_correctness:  r.mean_correctness  != null ? +r.mean_correctness.toFixed(2)  : null,
        mean_fluency:      r.mean_fluency       != null ? +r.mean_fluency.toFixed(2)       : null,
      })),

      items: rows.map(({ id, stats }) => ({
        item_id: id,
        ...Object.fromEntries(DIMENSIONS.flatMap((d) => [
          [`${d}_mean`, stats[d]?.mean   != null ? +Number(stats[d]!.mean).toFixed(2)   : null],
          [`${d}_sd`,   stats[d]?.stddev != null ? +Number(stats[d]!.stddev).toFixed(2) : null],
          [`${d}_n`,    stats[d]?.n ?? null],
        ])),
      })),

      high_disagreement_items: {
        description: "ข้อที่ผู้ประเมินมีความเห็นไม่สอดคล้องกัน ควรทบทวน rubric หรือข้อคำถาม",
        threshold: `SD ≥ ${SD_HIGH_THRESHOLD} ในอย่างน้อยหนึ่งมิติ`,
        count: highSdItems.length,
        items: highSdItems,
      },
    };

    const json = JSON.stringify(output, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eval_research_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }, [rows, alpha, raterSummary]);

  const exportRawJSON = useCallback(() => {
    const raterMap = new Map(raterSummary.map((r) => [r.user_id, { name: r.name, position: r.position }]));
    const scores = rawScores
      .filter((s) => s.completeness !== null || s.correctness !== null || s.fluency !== null)
      .sort((a, b) => a.item_id - b.item_id)
      .map((s) => ({
        item_id: s.item_id,
        rater_name: raterMap.get(s.rater_id)?.name ?? s.rater_id,
        rater_position: raterMap.get(s.rater_id)?.position ?? "",
        completeness: s.completeness,
        correctness: s.correctness,
        fluency: s.fluency,
        comment: s.comment ?? null,
      }));

    const output = {
      metadata: {
        title: "คะแนนรายข้อ-รายคน (Human Evaluation)",
        export_date: new Date().toISOString().slice(0, 10),
        num_raters: raterSummary.length,
        num_items: 100,
        rating_scale: "1–5",
        dimensions: DIMENSIONS.map((d) => ({ key: d, label: RUBRIC[d].label })),
        note: "หนึ่งแถวต่อหนึ่งคู่ (ผู้ให้คะแนน × ข้อ) เหมาะสำหรับ scatter plot / distribution analysis",
      },
      scores,
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eval_raw_scores_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }, [rawScores, raterSummary]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "raters", label: "ผู้ให้คะแนน" },
    { key: "items", label: "รายข้อ" },
    { key: "stats", label: "สถิติรวม" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← หน้าหลัก</Link>
            <h1 className="font-bold text-lg">Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">Export CSV</button>
            <button onClick={exportRawJSON} className="text-sm border border-blue-300 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50">Export รายข้อ-รายคน</button>
            <button onClick={exportAI} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">Export สำหรับ AI</button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto flex gap-1 mt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Tab: ผู้ให้คะแนน */}
        {tab === "raters" && (
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">ผู้ให้คะแนนทั้งหมด ({raterSummary.length} คน)</h3>
            </div>
            {raterSummary.length === 0 ? (
              <p className="text-gray-400 text-sm p-6 text-center">ยังไม่มีผู้ให้คะแนน</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2 text-left">ชื่อ</th>
                    <th className="px-4 py-2 text-left">ตำแหน่ง</th>
                    <th className="px-3 py-2 text-center">ความคืบหน้า</th>
                    <th className="px-3 py-2 text-right">ความครบถ้วน</th>
                    <th className="px-3 py-2 text-right">ความถูกต้อง</th>
                    <th className="px-3 py-2 text-right">ความไหลลื่น</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {raterSummary.map((r) => (
                    <tr key={r.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/rater/${r.user_id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.position}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.done === 100 ? "bg-green-100 text-green-700" :
                          r.done > 0 ? "bg-amber-100 text-amber-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {r.done} / 100
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.mean_completeness != null ? r.mean_completeness.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.mean_correctness != null ? r.mean_correctness.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.mean_fluency != null ? r.mean_fluency.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: รายข้อ */}
        {tab === "items" && (
          <div className="bg-white rounded-lg border">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-sm">ตารางรายข้อ</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "id" | "sd")}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="id">เรียงตามข้อ</option>
                <option value="sd">เรียงตาม SD สูงสุด</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2 text-left">ข้อ</th>
                    {DIMENSIONS.map((d) => (
                      <>
                        <th key={`${d}-mean`} className="px-3 py-2 text-right">{RUBRIC[d].label} (mean)</th>
                        <th key={`${d}-sd`} className="px-3 py-2 text-right">SD</th>
                      </>
                    ))}
                    <th className="px-3 py-2 text-right">n</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map(({ id, stats, maxSd }) => (
                    <tr key={id} className={`hover:bg-gray-50 ${maxSd >= SD_HIGH_THRESHOLD ? "bg-red-50 hover:bg-red-100" : ""}`}>
                      <td className="px-4 py-2 font-medium">
                        {id}
                        {maxSd >= SD_HIGH_THRESHOLD && (
                          <span className="ml-1 text-xs text-red-500" title="SD สูง">!</span>
                        )}
                      </td>
                      {DIMENSIONS.map((d) => (
                        <>
                          <td key={`${d}-mean`} className="px-3 py-2 text-right tabular-nums">
                            {stats[d]?.mean != null ? Number(stats[d]!.mean).toFixed(2) : "—"}
                          </td>
                          <td key={`${d}-sd`} className={`px-3 py-2 text-right tabular-nums ${Number(stats[d]?.stddev ?? 0) >= SD_HIGH_THRESHOLD ? "text-red-600 font-semibold" : ""}`}>
                            {stats[d]?.stddev != null ? Number(stats[d]!.stddev).toFixed(2) : "—"}
                          </td>
                        </>
                      ))}
                      <td className="px-3 py-2 text-right text-gray-500">{stats.completeness?.n ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: สถิติรวม */}
        {tab === "stats" && <StatsPanel overall={overall} alpha={alpha} raterSummary={raterSummary} />}
      </main>
    </div>
  );
}
