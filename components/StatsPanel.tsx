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

interface Props {
  overall: OverallStat[];
  alpha: Alpha;
}

function alphaLabel(a: number | null): { label: string; color: string } {
  if (a === null) return { label: "ยังไม่มีข้อมูล (ต้องการ ≥2 คน)", color: "text-gray-400" };
  if (a >= 0.8) return { label: `${a.toFixed(3)} — ดีมาก`, color: "text-green-600" };
  if (a >= 0.67) return { label: `${a.toFixed(3)} — พอใช้`, color: "text-amber-600" };
  return { label: `${a.toFixed(3)} — ต้องระวัง`, color: "text-red-600" };
}

export default function StatsPanel({ overall, alpha }: Props) {
  const numRaters = overall[0]?.num_raters ?? 0;
  const itemsComplete = overall[0]?.items_complete ?? 0;

  return (
    <div className="space-y-4">
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
