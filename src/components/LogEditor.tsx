"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StarRating from "./StarRating";
import { useToast } from "./ToastProvider";
import { useAuth } from "./AuthProvider";

type Props = {
  movieId: string;
  title: string;
  logId?: string;
  initialDate?: string;
  initialRating?: number | null;
  initialReview?: string | null;
  initialRewatch?: boolean;
  initialTags?: string | null;
  label?: string;
  compact?: boolean;
  onSaved?: () => void;
};

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function LogEditor({ movieId, title, logId, initialDate, initialRating, initialReview, initialRewatch = false, initialTags, label, compact = false, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate ?? today());
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [review, setReview] = useState(initialReview ?? "");
  const [rewatch, setRewatch] = useState(initialRewatch);
  const [tags, setTags] = useState(initialTags ?? "");
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/logs", {
        method: logId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(logId ? { id: logId } : { movieId }), watchedAt: date, rating, review, rewatch, tags }),
      });
      const payload = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar esta entrada do diário.");
      notify(payload.message ?? (logId ? "Entrada do diário atualizada." : `${title} foi registrado.`));
      setOpen(false);
      onSaved?.();
      router.refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível salvar esta entrada do diário.", "error"); }
    finally { setSaving(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className={compact ? "quiet-button !px-3 !py-2 text-xs" : "accent-button"}>{label ?? (logId ? "Editar entrada" : "Registrar sessão")}</button>
    {open && <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby={`log-title-${movieId}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <form onSubmit={submit} className="modal-enter surface-raised max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] p-5 sm:rounded-[1.75rem] sm:p-7">
        <header className="flex items-start justify-between gap-5"><div><p className="eyebrow">{logId ? "Refine a memória" : "Nova entrada no diário"}</p><h2 id={`log-title-${movieId}`} className="mt-2 text-2xl font-black tracking-tight text-white">{title}</h2></div><button type="button" onClick={() => setOpen(false)} className="icon-button h-9 w-9" aria-label="Fechar editor do diário">×</button></header>
        <div className="mt-7 grid gap-5">
          <label className="grid gap-2"><span className="eyebrow !text-slate-500">Assistido em</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="field [color-scheme:dark]" /></label>
          <fieldset><legend className="eyebrow !text-slate-500">Sua nota</legend><div className="mt-3 flex items-center gap-4"><StarRating value={rating} onChange={setRating} size="lg" /><button type="button" onClick={() => setRating(null)} className="text-xs font-bold text-slate-500 hover:text-white">Limpar</button></div></fieldset>
          <label className="grid gap-2"><span className="eyebrow !text-slate-500">Resenha ou nota</span><textarea value={review} onChange={(event) => setReview(event.target.value)} rows={6} maxLength={12000} placeholder="O que ficou com você?" className="field resize-y leading-6" /></label>
          <label className="grid gap-2"><span className="eyebrow !text-slate-500">Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} maxLength={800} placeholder="cinema, família, prêmios" className="field" /></label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><input type="checkbox" checked={rewatch} onChange={(event) => setRewatch(event.target.checked)} className="h-4 w-4 accent-amber-300" /><span><span className="block text-sm font-bold text-white">Isto foi uma reexibição</span><span className="text-xs text-slate-500">Preserva como um evento de exibição independente.</span></span></label>
        </div>
        <footer className="mt-7 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="quiet-button">Cancelar</button><button type="submit" disabled={saving} className="accent-button">{saving ? "Salvando…" : logId ? "Salvar alterações" : "Adicionar ao diário"}</button></footer>
      </form>
    </div>}
  </>;
}
