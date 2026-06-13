"use client";

import { useRouter } from "next/navigation";
import { RUBRIC } from "@/lib/rubric";

const SCORE_COLOR: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-green-100 text-green-700 border-green-300",
  5: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export default function TutorialClient() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h1 className="text-2xl font-bold text-gray-800">คู่มือการให้คะแนน</h1>
          <p className="text-gray-500 mt-2 text-sm">อ่านให้ครบก่อนเริ่มให้คะแนน เพื่อความสม่ำเสมอในการประเมิน</p>
        </div>

        {/* Task overview */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold text-lg text-gray-800">🎯 งานของท่านคืออะไร</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            ท่านจะได้รับ <strong>คำถาม</strong> พร้อม <strong>คำตอบของแชตบอต</strong> และ <strong>คำตอบที่ถูกต้อง (Ground Truth)</strong>
            รวมทั้งสิ้น <strong>100 ข้อ</strong>
          </p>
          <p className="text-gray-600 text-sm leading-relaxed">
            ให้ท่านประเมินคุณภาพคำตอบของแชตบอตใน <strong>3 มิติ</strong> โดยให้คะแนน <strong>1–5</strong> แต่ละมิติ
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            💡 เปรียบเทียบคำตอบของแชตบอตกับ Ground Truth เสมอ ไม่ใช่ตัดสินจากความรู้ส่วนตัว
          </div>
        </div>

        {/* 3 dimensions */}
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <h2 className="font-semibold text-lg text-gray-800">📐 3 มิติที่ใช้ประเมิน</h2>

          {(Object.entries(RUBRIC) as [string, typeof RUBRIC[keyof typeof RUBRIC]][]).map(([key, dim], idx) => (
            <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <span className="font-semibold text-gray-800">{dim.label}</span>
              </div>
              <div className="px-4 py-3 space-y-3">
                <p className="text-sm text-gray-600">{dim.desc}</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {(Object.entries(dim.anchors) as [string, string][]).map(([score, label]) => (
                    <div key={score} className={`flex gap-3 items-start rounded-md border px-3 py-2 text-sm ${SCORE_COLOR[Number(score)]}`}>
                      <span className="font-bold w-4 shrink-0">{score}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Keyboard shortcuts */}
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg text-gray-800">⌨️ วิธีใช้งาน</h2>

          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3 items-start">
              <span className="shrink-0 font-medium text-gray-800 w-28">กดปุ่ม 1–5</span>
              <span>ให้คะแนนมิติที่กำลัง focus อยู่ (กรอบสีน้ำเงิน) ระบบจะเลื่อนไปมิติถัดไปอัตโนมัติ</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 font-medium text-gray-800 w-28">กด Enter</span>
              <span>ไปข้อถัดไป (ต้องให้คะแนนครบทั้ง 3 มิติก่อน)</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 font-medium text-gray-800 w-28">กด ← / →</span>
              <span>เลื่อนระหว่างข้อได้อย่างอิสระ (ข้อที่ให้แล้วจะถูกบันทึกไว้)</span>
            </div>
            <div className="flex gap-3 items-start">
              <span className="shrink-0 font-medium text-gray-800 w-28">คลิก</span>
              <span>คลิกที่คะแนน 1–5 ในแต่ละมิติก็ได้เช่นกัน</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            ⚠️ ระบบ<strong>บันทึกอัตโนมัติ</strong>ทุกครั้งที่กดถัดไปหรือย้อนกลับ ไม่ต้องกังวลว่าข้อมูลจะหาย
          </div>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold text-lg text-gray-800">💡 เคล็ดลับ</h2>
          <ul className="space-y-2 text-sm text-gray-600 list-none">
            <li className="flex gap-2"><span>•</span><span>ประเมินแต่ละมิติ<strong>อิสระจากกัน</strong> มิติหนึ่งอาจได้ 5 อีกมิติอาจได้ 2</span></li>
            <li className="flex gap-2"><span>•</span><span>ถ้าคำตอบถูกต้องแต่พูดถึงประเด็นอื่นไม่ครบ → ความถูกต้องสูง แต่ความครบถ้วนต่ำ</span></li>
            <li className="flex gap-2"><span>•</span><span>ใช้ช่อง<strong>หมายเหตุ</strong>จดสิ่งที่ควรอธิบายเพิ่มเติมหรือกรณีที่ไม่แน่ใจ</span></li>
            <li className="flex gap-2"><span>•</span><span>สามารถกลับมาแก้คะแนนข้อก่อนหน้าได้ตลอดเวลา</span></li>
          </ul>
        </div>

        {/* Start button */}
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-gray-500 text-sm mb-4">เมื่อพร้อมแล้วกดปุ่มด้านล่างเพื่อเริ่มให้คะแนน</p>
          <button
            onClick={() => router.push("/score")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-lg"
          >
            เริ่มให้คะแนนเลย →
          </button>
        </div>

      </div>
    </div>
  );
}
