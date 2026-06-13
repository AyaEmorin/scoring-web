"use client";

interface ScoreStatus {
  item_id: number;
  completeness: number | null;
  correctness: number | null;
  fluency: number | null;
}

interface Props {
  scores: ScoreStatus[];
  currentItem: number;
  onJump: (id: number) => void;
}

function getStatus(scores: ScoreStatus[], id: number): "done" | "partial" | "none" {
  const s = scores.find((x) => x.item_id === id);
  if (!s) return "none";
  if (s.completeness && s.correctness && s.fluency) return "done";
  if (s.completeness || s.correctness || s.fluency) return "partial";
  return "none";
}

export default function ProgressGrid({ scores, currentItem, onJump }: Props) {
  return (
    <div>
      <div className="flex gap-3 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />ครบ 3 มิติ</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />ทำบางส่วน</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" />ยังไม่ทำ</span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 100 }, (_, i) => i + 1).map((id) => {
          const status = getStatus(scores, id);
          const isCurrent = id === currentItem;
          return (
            <button
              key={id}
              onClick={() => onJump(id)}
              title={`ข้อ ${id}`}
              className={`
                aspect-square rounded text-xs font-medium transition-all
                ${status === "done" ? "bg-green-500 text-white" : ""}
                ${status === "partial" ? "bg-amber-400 text-white" : ""}
                ${status === "none" ? "bg-gray-200 text-gray-600 hover:bg-gray-300" : ""}
                ${isCurrent ? "ring-2 ring-blue-500 ring-offset-1" : ""}
              `}
            >
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
