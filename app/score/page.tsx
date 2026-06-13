import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/requireProfile";
import { getIsAdmin } from "@/lib/getAdminStatus";
import ScorePageClient from "./ScorePageClient";

interface Props {
  searchParams: Promise<{ item?: string }>;
}

export default async function ScorePage({ searchParams }: Props) {
  const { user } = await requireProfile();
  const isAdmin = await getIsAdmin(user.email!);
  if (isAdmin) redirect("/dashboard");
  const supabase = await createClient();

  const params = await searchParams;
  const itemId = Math.min(100, Math.max(1, parseInt(params.item ?? "1", 10) || 1));

  const [{ data: item }, { data: scores }] = await Promise.all([
    supabase.from("items").select("*").eq("id", itemId).single(),
    supabase
      .from("scores")
      .select("item_id, completeness, correctness, fluency, comment")
      .eq("rater_id", user.id),
  ]);

  if (!item) redirect("/");

  const currentScore = scores?.find((s) => s.item_id === itemId) ?? null;

  return (
    <ScorePageClient
      item={item}
      allScores={scores ?? []}
      initialScore={currentScore}
      userId={user.id}
    />
  );
}
