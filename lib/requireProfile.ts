import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, position")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/profile/setup");

  return { user, profile: profile as { first_name: string; last_name: string; position: string } };
}
