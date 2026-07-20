import { redirect } from "next/navigation";
import LetterboxdImport from "@/components/LetterboxdImport";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfil e configurações — FilmJournal",
};

const STEPS = [
  ["Exporte seus dados", "No Letterboxd: Settings → Data → “Export your data”. Você receberá um arquivo .zip."],
  ["Envie o arquivo", "Arraste o .zip inteiro abaixo. Também é possível selecionar os arquivos .csv separados."],
  ["Acompanhe seu acervo", "Diário, notas, resenhas, watchlist e favoritos serão associados somente à sua conta."],
] as const;

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const displayName = user.displayName || user.username;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <main className="page-shell max-w-5xl space-y-10">
      <section className="surface relative overflow-hidden rounded-[2rem] p-7 sm:p-10">
        <div className="glass-gradient absolute inset-0 -z-10" />
        <p className="eyebrow">Sua conta</p>
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-2xl font-black text-amber-200" aria-hidden="true">{initials || "FJ"}</span>
          <div>
            <h1 className="display-title text-4xl sm:text-6xl">Perfil e configurações.</h1>
            <p className="mt-3 text-sm text-slate-400">
              <span className="font-bold text-white">{displayName}</span> · @{user.username}
              {user.role === "OWNER" ? " · Proprietário" : ""}
            </p>
          </div>
        </div>
      </section>

      <section id="importar" className="scroll-mt-28 space-y-6">
        <div>
          <p className="eyebrow">Dados e importação</p>
          <h2 className="section-heading mt-2">Importar do Letterboxd.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Use esta configuração quando quiser trazer ou atualizar seu histórico. Reenviar o mesmo export é seguro: as entradas existentes são reconciliadas sem duplicação.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(([title, body], index) => (
            <div key={title} className="surface-subtle rounded-2xl p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-300 text-sm font-black text-[#1a1400]">{index + 1}</span>
              <h3 className="mt-4 text-sm font-black text-white">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
            </div>
          ))}
        </div>

        <LetterboxdImport />
      </section>
    </main>
  );
}
