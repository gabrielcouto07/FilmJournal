import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { needsOnboarding } from "@/lib/onboarding";
import WelcomeFlow from "@/components/WelcomeFlow";

export const metadata = { title: "Bem-vindo · FilmJournal" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");
  // Quem já passou pela introdução segue direto para o início.
  if (!(await needsOnboarding(viewer.id))) redirect("/");
  return <WelcomeFlow displayName={viewer.displayName ?? viewer.username} />;
}
