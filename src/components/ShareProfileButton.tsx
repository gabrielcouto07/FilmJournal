"use client";

import { useToast } from "./ToastProvider";

export default function ShareProfileButton({ username }: { username: string }) {
  const { notify } = useToast();

  async function share() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `FilmJournal — @${username}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify("Link do perfil copiado! 🔗", "success");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return; // user closed the share sheet
      notify("Não foi possível copiar o link.", "error");
    }
  }

  return (
    <button type="button" onClick={share} className="quiet-button !px-4 !py-2 text-xs" aria-label={`Compartilhar o perfil de ${username}`}>
      Compartilhar perfil ↗
    </button>
  );
}
