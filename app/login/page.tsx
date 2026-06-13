"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "เกิดข้อผิดพลาด");
      setLoading(false);
      inputRef.current?.select();
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-bold mb-1 text-center">Human Eval</h1>
        <p className="text-sm text-gray-500 text-center mb-8">ระบบให้คะแนนคำตอบแชตบอต</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="code">
              รหัสลับ
            </label>
            <input
              ref={inputRef}
              id="code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-center text-xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              placeholder="XXXXXXXX"
              maxLength={8}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          รหัสลับได้รับจากผู้ดูแลระบบ
        </p>
      </div>
    </div>
  );
}
