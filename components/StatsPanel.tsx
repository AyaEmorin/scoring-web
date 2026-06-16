"use client";

import { RUBRIC, type Dimension, DIMENSIONS } from "@/lib/rubric";

interface OverallStat {
  dim: string;
  mean: number | null;
  num_raters: number;
  items_complete: number;
}

interface Alpha {
  completeness: number | null;
  correctness: number | null;
  fluency: number | null;
}

interface RaterSummary {
  mean_completeness: number | null;
  mean_correctness: number | null;
  mean_fluency: number | null;
}

interface Props {
  overall: OverallStat[];
  alpha: Alpha;
  raterSummary: RaterSummary[];
}

const MEAN_KEY: Record<Dimension, keyof RaterSummary> = {
  completeness: "mean_completeness",
  correctness: "mean_correctness",
  fluency: "mean_fluency",
};

function sampleSD(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function interpretMean(mean: number): { text: string; color: string } {
  if (mean >= 4.21) return { text: "ดีมาก", color: "text-green-600" };
  if (mean >= 3.41) return { text: "ดี", color: "text-blue-600" };
  if (mean >= 2.61) return { text: "ปานกลาง", color: "text-amber-600" };
  if (mean >= 1.81) return { text: "พอใช้", color: "text-orange-600" };
  return { text: "ควรปรับปรุง", color: "text-red-600" };
}

function alphaLabel(a: number | null): { label: string; color: string } {
  if (a === null) return { label: "ยังไม่มีข้อมูล (ต้องการ ≥2 คน)", color: "text-gray-400" };
  if (a >= 0.8) return { label: `${a.toFixed(3)} — ดีมาก`, color: "text-green-600" };
  if (a >= 0.67) return { label: `${a.toFixed(3)} — พอใช้`, color: "text-amber-600" };
  return { label: `${a.toFixed(3)} — ต้องระวัง`, color: "text-red-600" };
}

export default function StatsPanel({ overall, alpha, raterSummary }: Props) {
  const numRaters = overall[0]?.num_raters ?? 0;
  const itemsComplete = overall[0]?.items_complete ?? 0;

  // คำนวณ mean และ S.D. (sample, n−1) จากค่าเฉลี่ยของผู้ให้คะแนนแต่ละท่านต่อมิติ
  const dimStats = DIMENSIONS.map((dim) => {
    const vals = raterSummary
      .map((r) => r[MEAN_KEY[dim]])
      .filter((v): v is number => v !== null);
    const ready = raterSummary.length > 0 && vals.length === raterSummary.length;
    if (!ready) return { dim, mean: null as number | null, sd: null as number | null };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = sampleSD(vals);
    return { dim, mean, sd };
  });

  const allReady = dimStats.every((s) => s.mean !== null);
  const overallMean = allReady
    ? dimStats.reduce((sum, s) => sum + s.mean!, 0) / dimStats.length
    : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">ผู้ให้คะแนน</p>
          <p className="text-2xl font-bold">{numRaters}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 mb-1">ข้อที่มีคะแนนครบ</p>
          <p className="text-2xl font-bold">{itemsComplete}</p>
          <p className="text-xs text-gray-400">/ 100</p>
        </div>
        {DIMENSIONS.map((dim) => {
          const stat = overall.find((o) => o.dim === dim);
          return (
            <div key={dim} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 mb-1">{RUBRIC[dim].label}</p>
              <p className="text-2xl font-bold">
                {stat?.mean != null ? Number(stat.mean).toFixed(2) : "—"}
              </p>
              <p className="text-xs text-gray-400">ค่าเฉลี่ยรวม</p>
            </div>
          );
        })}
      </div>

      {/* ตารางสรุปคะแนนรายมิติ */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">ตารางสรุปคะแนน</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            คำนวณจากค่าเฉลี่ยของผู้ประเมินแต่ละท่าน ({raterSummary.length} ท่าน) · S.D. แบบ sample (หารด้วย n−1)
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left">มิติ</th>
              <th className="px-4 py-2 text-right">ค่าเฉลี่ย (x̄)</th>
              <th className="px-4 py-2 text-right">S.D.</th>
              <th className="px-4 py-2 text-left">การแปลผล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dimStats.map(({ dim, mean, sd }) => {
              const interp = mean !== null ? interpretMean(mean) : null;
              return (
                <tr key={dim} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{RUBRIC[dim as Dimension].label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {mean !== null ? mean.toFixed(2) : (
                      <span className="text-gray-400 text-xs font-normal">รอข้อมูล</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sd !== null ? sd.toFixed(2) : (
                      <span className="text-gray-400 text-xs font-normal">รอข้อมูล</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {interp ? (
                      <span className={`text-xs font-medium ${interp.color}`}>{interp.text}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">รอข้อมูล</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {/* แถวค่าเฉลี่ยรวม */}
            <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <td className="px-4 py-3">ค่าเฉลี่ยรวม 3 มิติ</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {overallMean !== null ? overallMean.toFixed(2) : (
                  <span className="text-gray-400 font-normal text-xs">รอข้อมูล</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-400 font-normal">—</td>
              <td className="px-4 py-3">
                {overallMean !== null ? (
                  (() => {
                    const interp = interpretMean(overallMean);
                    return <span className={`text-xs font-medium ${interp.color}`}>{interp.text}</span>;
                  })()
                ) : (
                  <span className="text-gray-400 font-normal text-xs">รอข้อมูล</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="px-4 py-2 border-t bg-gray-50">
          <p className="text-xs text-gray-400">
            เกณฑ์แปลผล: 4.21–5.00 ดีมาก · 3.41–4.20 ดี · 2.61–3.40 ปานกลาง · 1.81–2.60 พอใช้ · 1.00–1.80 ควรปรับปรุง
          </p>
        </div>
      </div>

      {/* Inter-rater reliability */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold mb-3 text-sm">Inter-Rater Reliability — Krippendorff&apos;s Alpha (ordinal)</h3>
        <div className="space-y-2">
          {DIMENSIONS.map((dim) => {
            const { label, color } = alphaLabel(alpha[dim as Dimension]);
            return (
              <div key={dim} className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{RUBRIC[dim].label}</span>
                <span className={`font-medium ${color}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">≥0.8 ดีมาก · 0.67–0.8 พอใช้ · &lt;0.67 ต้องระวัง</p>
      </div>
    </div>
  );
}
