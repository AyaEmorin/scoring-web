import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
  const { code } = await request.json() as { code: string };

  if (!code?.trim()) {
    return NextResponse.json({ error: "กรุณาใส่รหัสลับ" }, { status: 400 });
  }

  // ค้นหา email จากรหัสลับ (ผ่าน admin client เพื่อข้าม RLS)
  const admin = getAdminClient();
  const { data: raterRaw, error: dbError } = await admin
    .from("rater_codes")
    .select("email, rater_name")
    .eq("code", code.trim().toUpperCase())
    .single();

  if (dbError) {
    return NextResponse.json({ error: `DB error: ${dbError.message}` }, { status: 500 });
  }

  const rater = raterRaw as { email: string; rater_name: string } | null;

  if (!rater) {
    return NextResponse.json({ error: "รหัสลับไม่ถูกต้อง" }, { status: 401 });
  }

  // สร้าง response เปล่าเพื่อเก็บ cookies ที่ supabase จะ set
  const response = new NextResponse(JSON.stringify({ ok: true, name: rater.rater_name }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options ?? {})
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: rater.email,
    password: code.trim().toUpperCase(),
  });

  if (error) {
    return NextResponse.json({ error: "เข้าสู่ระบบไม่ได้ กรุณาติดต่อผู้ดูแล" }, { status: 401 });
  }

  return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
