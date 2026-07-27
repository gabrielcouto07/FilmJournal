import { redirect } from "next/navigation";

// Rota antiga: links salvos por aí ainda apontam para cá.
export default function WatchlistPage() {
  redirect("/collection?tab=assistir");
}
