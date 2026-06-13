import { requireProfile } from "@/lib/requireProfile";
import TutorialClient from "./TutorialClient";

export default async function TutorialPage() {
  await requireProfile();
  return <TutorialClient />;
}
