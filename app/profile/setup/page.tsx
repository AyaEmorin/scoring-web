"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ first_name: "", last_name: "", position: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "เกิดข้อผิดพลาด");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-bold mb-1">ยินดีต้อนรับ</h1>
        <p className="text-sm text-gray-500 mb-6">กรุณากรอกข้อมูลของท่านก่อนเริ่มให้คะแนน</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">ชื่อ</label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="สมชาย"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">นามสกุล</label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ใจดี"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ตำแหน่ง / สาขาความเชี่ยวชาญ</label>
            <input
              type="text"
              required
              value={form.position}
              onChange={(e) => set("position", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น อาจารย์ภาษาไทย, นักภาษาศาสตร์"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? "กำลังบันทึก..." : "เริ่มให้คะแนน →"}
          </button>
        </form>
      </div>
    </div>
  );
}
