import { redirect } from "next/navigation";

// The Roleta now lives inside the "Jogos" hub (/play). This route stays as a
// permanent redirect so old links and saved landing-page prefs keep working.
export default function RoulettePage() {
  redirect("/play?tab=roleta");
}
