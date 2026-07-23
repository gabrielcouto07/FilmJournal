import { redirect } from "next/navigation";

// Mantém links antigos funcionando após a Roleta entrar na página de jogos.
export default function RoulettePage() {
  redirect("/play?tab=roleta");
}
