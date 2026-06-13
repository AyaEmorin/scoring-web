import { getAdminClient } from "@/lib/supabase/admin";

export async function getIsAdmin(email: string): Promise<boolean> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("rater_codes")
    .select("is_admin")
    .eq("email", email)
    .single();
  return (data as { is_admin: boolean } | null)?.is_admin ?? false;
}
