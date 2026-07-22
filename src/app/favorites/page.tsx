import { redirect } from "next/navigation";

// Favoritos now lives inside the "Minha lista" hub (/collection). This route
// stays as a redirect so old links and saved landing-page prefs keep working.
export default function FavoritesPage() {
  redirect("/collection?tab=favoritos");
}
