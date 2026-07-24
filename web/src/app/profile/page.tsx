import LetterboxdImport from "@/components/LetterboxdImport";
import ProfileSettings from "@/components/ProfileSettings";
import { apiGet } from "@/lib/api-server";
import type { AppSettings } from "@/lib/settings";

export const metadata = {
  title: "Perfil e configurações — FilmJournal",
};

type ProfileResponse = {
  user: {
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    email: string;
    role: string;
    createdAt: string;
  };
};

export default async function ProfilePage() {
  const [{ user }, { settings }] = await Promise.all([
    apiGet<ProfileResponse>("/profile"),
    apiGet<{ settings: AppSettings }>("/settings"),
  ]);
  const displayName = user.displayName || user.username;
  const memberSince = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(user.createdAt));

  return (
    <main className="page-shell max-w-5xl space-y-8">
      <section className="surface relative overflow-hidden rounded-[2rem] p-7 sm:p-10">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Sua conta</p>
        <h1 className="display-title mt-4 text-4xl sm:text-6xl">Perfil e configurações.</h1>
        <p className="mt-3 text-sm text-slate-400">
          <span className="font-bold text-white">{displayName}</span> · @{user.username}
          {user.role === "OWNER" ? " · Proprietário" : ""}
        </p>
      </section>

      <ProfileSettings
        user={{
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          email: user.email,
          role: user.role,
          memberSince,
        }}
        settings={settings}
      />

      <section id="importar" className="scroll-mt-28 space-y-5">
        <div>
          <p className="eyebrow">Dados e importação</p>
          <h2 className="section-heading mt-2">Importar do Letterboxd.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Traga ou atualize seu histórico. Reenviar o mesmo export é seguro: as entradas existentes são reconciliadas sem duplicação.
          </p>
        </div>
        <LetterboxdImport />
      </section>
    </main>
  );
}
