"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

type Summary = {
  films: number;
  events: number;
  moviesCreated: number;
  moviesUpdated: number;
  userMoviesCreated: number;
  userMoviesUpdated: number;
  logsCreated: number;
  logsUpdated: number;
  filesReceived: string[];
};

const KNOWN_CSVS = new Set(["diary.csv", "reviews.csv", "ratings.csv", "watched.csv", "watchlist.csv", "profile.csv"]);
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function mapCsvName(name: string): string | null {
  const lower = name.toLowerCase();
  if (KNOWN_CSVS.has(lower)) return lower;
  if (lower === "films.csv") return "likes/films.csv"; // the export only ships films.csv inside likes/
  return null;
}

export default function LetterboxdImport() {
  const [zip, setZip] = useState<File | null>(null);
  const [csvs, setCsvs] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  const router = useRouter();

  const selectedLabel = zip
    ? zip.name
    : csvs.length
      ? `${csvs.length} arquivo${csvs.length > 1 ? "s" : ""} CSV selecionado${csvs.length > 1 ? "s" : ""}`
      : null;

  function rejectSelection(message: string) {
    setZip(null);
    setCsvs([]);
    setSummary(null);
    setWarnings([]);
    setError(message);
    setStatus("error");
    if (inputRef.current) inputRef.current.value = "";
  }

  function accept(list: FileList | null) {
    const arr = list ? [...list] : [];
    if (!arr.length) return;
    const found = arr.find((file) => file.name.toLowerCase().endsWith(".zip"));
    if (found) {
      if (found.size > MAX_UPLOAD_BYTES) {
        rejectSelection("O arquivo excede o limite de 4 MB da importação web.");
        return;
      }
      setZip(found);
      setCsvs([]);
    } else {
      const valid = arr.filter((file) => mapCsvName(file.name));
      if (!valid.length) {
        rejectSelection("Envie o .zip do Letterboxd ou os arquivos .csv (diary, ratings, watched…).");
        return;
      }
      if (valid.reduce((total, file) => total + file.size, 0) > MAX_UPLOAD_BYTES) {
        rejectSelection("Os arquivos excedem o limite total de 4 MB da importação web.");
        return;
      }
      setCsvs(valid);
      setZip(null);
    }
    setError(null);
    setStatus("idle");
    setSummary(null);
    setWarnings([]);
  }

  async function submit() {
    if (!zip && !csvs.length) return;
    setStatus("uploading");
    setError(null);
    const form = new FormData();
    if (zip) form.append("archive", zip);
    else csvs.forEach((file) => { const name = mapCsvName(file.name); if (name) form.append(name, file); });

    try {
      const res = await fetch("/api/import/letterboxd", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível importar.");
      setSummary(data.summary as Summary);
      setWarnings(Array.isArray(data.errors) ? data.errors.filter((item: unknown): item is string => typeof item === "string") : []);
      setStatus("done");
      notify("Importação concluída! 🎬", "success");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível importar.";
      setError(message);
      setStatus("error");
      notify(message, "error");
    }
  }

  function reset() {
    setZip(null);
    setCsvs([]);
    setSummary(null);
    setWarnings([]);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (status === "done" && summary) {
    const totalLogs = summary.logsCreated + summary.logsUpdated;
    return (
      <section className="surface fade-up rounded-[1.75rem] p-7 sm:p-9" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-lg" aria-hidden="true">✓</span>
          <div>
            <h2 className="text-xl font-black text-white">Seu perfil foi preenchido.</h2>
            <p className="text-sm text-slate-400">Importamos {summary.films} filme{summary.films === 1 ? "" : "s"} e {summary.events} sessõe{summary.events === 1 ? "" : "s"} de diário.</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Filmes" value={summary.films} />
          <Stat label="Sessões" value={totalLogs} accent />
          <Stat label="Novos no catálogo" value={summary.moviesCreated} />
          <Stat label="Coleção atualizada" value={summary.userMoviesCreated + summary.userMoviesUpdated} />
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          As capas e fichas técnicas (TMDB) são carregadas automaticamente conforme você abre cada filme.
        </p>
        {warnings.length > 0 && (
          <div role="status" className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
            <p className="font-black">Importação concluída com avisos:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/diary" className="accent-button">Ver meu diário →</Link>
          <Link href="/" className="quiet-button">Ver seu paladar</Link>
          <button type="button" onClick={reset} className="quiet-button">Importar outro arquivo</button>
        </div>
      </section>
    );
  }

  const busy = status === "uploading";

  return (
    <section className="space-y-4" aria-busy={busy}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Selecionar arquivo do Letterboxd"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !busy) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) accept(event.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed px-6 py-14 text-center transition ${dragging ? "border-amber-300/70 bg-amber-300/[0.06]" : "border-white/12 bg-white/[0.02] hover:border-amber-300/40 hover:bg-white/[0.03]"} ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-2xl" aria-hidden="true">📦</span>
        <p className="mt-5 text-base font-black text-white">{selectedLabel ?? "Arraste o .zip do Letterboxd aqui"}</p>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          {selectedLabel ? "Pronto para importar." : "ou clique para escolher o arquivo. Também aceitamos os arquivos .csv soltos que vêm dentro do .zip."}
        </p>
        <p className="mt-2 text-xs text-slate-600">Limite da importação web: 4 MB.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.csv"
          multiple
          className="hidden"
          onChange={(event) => accept(event.target.files)}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-bold text-red-300">{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!zip && !csvs.length)}
          className="accent-button px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Importando…" : "Importar meus filmes"}
        </button>
        {selectedLabel && !busy && (
          <button type="button" onClick={reset} className="text-xs font-bold text-slate-500 hover:text-white">Limpar seleção</button>
        )}
        {busy && <span role="status" className="text-xs font-bold text-amber-300/80">Isso pode levar um momento para bibliotecas grandes…</span>}
      </div>
    </section>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="surface-subtle rounded-2xl p-4">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${accent ? "text-amber-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
