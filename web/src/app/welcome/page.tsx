import { redirect } from "next/navigation";
import { apiGet, getSessionUser } from "@/lib/api-server";
import WelcomeFlow from "@/components/WelcomeFlow";

export const metadata = { title: "Bem-vindo · FilmJournal" };
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/login");
  // Quem já passou pela introdução segue direto para o início.
  const { onboarded } = await apiGet<{ onboarded: boolean }>("/profile");
  if (onboarded) redirect("/");
  return <WelcomeFlow displayName={viewer.displayName ?? viewer.username} />;
}
