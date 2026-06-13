"use client";

import { useEffect, useRef } from "react";
import { RUBRIC, type Dimension } from "@/lib/rubric";

interface Props {
  dimension: Dimension;
  value: number | null;
  onChange: (v: number) => void;
  focused: boolean;
  onFocus: () => void;
}

export default function DimensionRater({ dimension, value, onChange, focused, onFocus }: Props) {
  const rubric = RUBRIC[dimension];
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFocused = useRef(focused);

  useEffect(() => {
    const wasFocused = prevFocused.current;
    prevFocused.current = focused;
    // scroll เฉพาะตอน focus เปลี่ยนจาก false → true (ไม่ scroll ตอน mount)
    if (focused && !wasFocused && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focused]);

  return (
    <div
      ref={containerRef}
      className={`rounded-lg border-2 p-3 transition-all cursor-pointer ${
        focused ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={onFocus}
    >
      <div className="flex items-center gap-2 mb-2">
        {focused && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
        <span className="font-medium text-sm">{rubric.label}</span>
      </div>

      <div className="mb-3 p-2 bg-gray-50 rounded text-xs text-gray-600 space-y-0.5">
        <p className="font-medium text-gray-700 mb-1">{rubric.desc}</p>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <div key={n} className="flex gap-2">
            <span className="font-bold w-3 shrink-0 text-gray-500">{n}</span>
            <span>{rubric.anchors[n]}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(n); }}
            className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
              value === n
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
