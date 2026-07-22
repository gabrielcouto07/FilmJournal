import { redirect } from "next/navigation";

// Mantém links antigos funcionando após a mudança para "Minha lista".
export default function WatchlistPage() {
  redirect("/collection?tab=assistir");
}
