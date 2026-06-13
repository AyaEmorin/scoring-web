import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { first_name, last_name, position } = await request.json() as {
    first_name: string;
    last_name: string;
    position: string;
  };

  if (!first_name?.trim() || !last_name?.trim() || !position?.trim()) {
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      position: position.trim(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
