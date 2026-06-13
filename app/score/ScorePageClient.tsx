"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import ScoreCard from "@/components/ScoreCard";
import DimensionRater from "@/components/DimensionRater";
import ProgressGrid from "@/components/ProgressGrid";
import { createClient } from "@/lib/supabase/client";
import { DIMENSIONS, type Dimension } from "@/lib/rubric";

interface Item {
  id: number;
  question: string;
  expected_topics: string | null;
  ground_truth: string | null;
  bot_answer: string;
}

interface ScoreRow {
  item_id: number;
  completeness: number | null;
  correctness: number | null;
  fluency: number | null;
  comment?: string | null;
}

interface Props {
  item: Item;
  allScores: ScoreRow[];
  initialScore: ScoreRow | null;
  userId: string;
}

const DIM_LABELS: Record<Dimension, string> = {
  completeness: "ความครบถ้วน",
  correctness: "ความถูกต้อง",
  fluency: "ความไหลลื่น",
};

export default function ScorePageClient({ item, allScores, initialScore, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [scores, setScores] = useState<Record<Dimension, number | null>>({
    completeness: initialScore?.completeness ?? null,
    correctness: initialScore?.correctness ?? null,
    fluency: initialScore?.fluency ?? null,
  });
  const [comment, setComment] = useState(initialScore?.comment ?? "");
  const [focusedDim, setFocusedDim] = useState<number>(-1);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // เมื่อเปลี่ยนข้อ: โหลดคะแนนที่บันทึกไว้ หรือเริ่มที่ null (ไม่ carry-over)
  useEffect(() => {
    setScores({
      completeness: initialScore?.completeness ?? null,
      correctness: initialScore?.correctness ?? null,
      fluency: initialScore?.fluency ?? null,
    });
    setComment(initialScore?.comment ?? "");
    setFocusedDim(-1);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveScore = useCallback(
    async (overrideScores?: typeof scores, overrideComment?: string) => {
      const s = overrideScores ?? scores;
      const c = overrideComment ?? comment;
      setSaving(true);
      await supabase.from("scores").upsert(
        {
          rater_id: userId,
          item_id: item.id,
          completeness: s.completeness,
          correctness: s.correctness,
          fluency: s.fluency,
          comment: c || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "rater_id,item_id" }
      );
      setSaving(false);
    },
    [scores, comment, userId, item.id, supabase]
  );

  function triggerSave(overrideScores?: typeof scores, overrideComment?: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveScore(overrideScores, overrideComment), 400);
  }

  function setDimScore(dim: Dimension, value: number) {
    const next = { ...scores, [dim]: value };
    setScores(next);
    triggerSave(next);
    const dimIdx = DIMENSIONS.indexOf(dim);
    if (dimIdx < DIMENSIONS.length - 1) setFocusedDim(dimIdx + 1);
  }

  function setCommentValue(c: string) {
    setComment(c);
    triggerSave(undefined, c);
  }

  async function validate(): Promise<boolean> {
    const unscored = DIMENSIONS.filter((d) => scores[d] === null);
    if (unscored.length > 0) {
      await Swal.fire({
        icon: "warning",
        title: "ให้คะแนนยังไม่ครบ",
        text: `กรุณาให้คะแนนทุกมิติก่อนไปข้อถัดไป (ยังขาด: ${unscored.map((d) => DIM_LABELS[d]).join(", ")})`,
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#3b82f6",
      });
      setFocusedDim(DIMENSIONS.indexOf(unscored[0]));
      return false;
    }
    const low = DIMENSIONS.filter((d) => scores[d] !== null && scores[d]! <= 2);
    if (low.length > 0 && !comment.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "กรุณาใส่คำแนะนำ",
        text: `มิติที่ได้คะแนน ≤ 2 ต้องมีคำแนะนำประกอบ (${low.map((d) => DIM_LABELS[d]).join(", ")})`,
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#3b82f6",
      });
      commentRef.current?.focus();
      return false;
    }
    return true;
  }

  async function navigate(direction: "prev" | "next") {
    if (direction === "next" && !(await validate())) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await saveScore();
    if (direction === "next" && item.id === 100) {
      await Swal.fire({
        icon: "success",
        title: "ให้คะแนนครบ 100 ข้อแล้ว!",
        text: "ขอบคุณสำหรับการประเมิน",
        confirmButtonText: "กลับหน้าหลัก",
        confirmButtonColor: "#3b82f6",
      });
      router.push("/");
      return;
    }
    const target = direction === "next" ? item.id + 1 : item.id - 1;
    if (target < 1) return;
    router.push(`/score?item=${target}`);
  }

  function jumpToItem(id: number) {
    router.push(`/score?item=${id}`);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // ไม่รับ input ขณะพิมพ์ใน textarea/input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      // ไม่รับขณะ SweetAlert เปิดอยู่
      if (document.querySelector(".swal2-container")) return;

      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const effectiveIdx = focusedDim === -1 ? 0 : focusedDim;
        const dim = DIMENSIONS[effectiveIdx];
        if (!dim) return;
        setFocusedDim(effectiveIdx);
        setDimScore(dim, parseInt(e.key, 10));
        return;
      }
      if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        navigate("next");
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigate("prev");
        return;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const doneCount = allScores.filter(
    (s) => s.completeness && s.correctness && s.fluency
  ).length;

  const allScored = DIMENSIONS.every((d) => scores[d] !== null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← หน้าหลัก</a>
            <span className="text-gray-300">|</span>
            <span className="font-semibold">ข้อ {item.id} / 100</span>
            <span className="text-sm text-gray-500">({doneCount} ข้อที่ทำเสร็จ)</span>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
            <button
              onClick={() => setShowGrid((v) => !v)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showGrid ? "ซ่อน" : "แผนที่"}
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${doneCount}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {showGrid && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ProgressGrid
              scores={allScores}
              currentItem={item.id}
              onJump={(id) => { setShowGrid(false); jumpToItem(id); }}
            />
          </div>
        )}

        <ScoreCard
          question={item.question}
          expectedTopics={item.expected_topics}
          groundTruth={item.ground_truth}
          botAnswer={item.bot_answer}
        />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">
            ให้คะแนน
            <span className="font-normal text-gray-400 ml-2 text-xs">
              กด <kbd className="bg-gray-100 border border-gray-300 rounded px-1">1</kbd>–<kbd className="bg-gray-100 border border-gray-300 rounded px-1">5</kbd> · <kbd className="bg-gray-100 border border-gray-300 rounded px-1">Enter</kbd> ไปข้อถัดไป
            </span>
          </h2>
          {DIMENSIONS.map((dim, idx) => (
            <DimensionRater
              key={dim}
              dimension={dim}
              value={scores[dim]}
              onChange={(v) => setDimScore(dim, v)}
              focused={focusedDim === idx}
              onFocus={() => setFocusedDim(idx)}
            />
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            คำแนะนำ / หมายเหตุ
            {DIMENSIONS.some((d) => scores[d] !== null && scores[d]! <= 2) && (
              <span className="text-red-500 ml-1 text-xs">* จำเป็นเมื่อให้คะแนน ≤ 2</span>
            )}
          </label>
          <textarea
            ref={commentRef}
            value={comment}
            onChange={(e) => setCommentValue(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="ข้อสังเกตเพิ่มเติม..."
          />
        </div>

        <div className="flex gap-3 pb-6">
          <button
            onClick={() => navigate("prev")}
            disabled={item.id <= 1}
            className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            ← ก่อนหน้า
          </button>
          <button
            onClick={() => navigate("next")}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              allScored
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {item.id === 100 ? "เสร็จสิ้น ✓" : "ถัดไป →"}
          </button>
        </div>
      </main>
    </div>
  );
}
