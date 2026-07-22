import { redirect } from "next/navigation";

// Para assistir now lives inside the "Minha lista" hub (/collection). This route
// stays as a redirect so old links and saved landing-page prefs keep working.
export default function WatchlistPage() {
  redirect("/collection?tab=assistir");
}
