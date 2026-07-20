"use client";
/* eslint-disable @next/next/no-img-element -- avatars are user-provided data URLs or arbitrary external URLs, which next/image cannot optimize/whitelist. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import { useSettings } from "@/components/SettingsProvider";
import { DEFAULT_ACCENT, type AppSettings } from "@/lib/settings";

type ProfileUser = {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  email: string;
  role: string;
  memberSince: string;
};

type Tab = "perfil" | "preferencias" | "privacidade" | "conta";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "perfil", label: "Perfil" },
  { id: "preferencias", label: "Preferências" },
  { id: "privacidade", label: "Privacidade" },
  { id: "conta", label: "Conta" },
];

const ACCENT_PRESETS = ["#f5c518", "#ff7c86", "#74b9ff", "#b79cff", "#5ee6a8", "#ff9f45"];

async function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "FJ";
}

export default function ProfileSettings({ user, settings: initial }: { user: ProfileUser; settings: AppSettings }) {
  const [tab, setTab] = useState<Tab>("perfil");
  const { notify } = useToast();
  const { setSettings } = useSettings();
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1" aria-label="Seções do perfil">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wider transition ${tab === item.id ? "bg-[var(--accent)] text-[#1a1400]" : "text-slate-400 hover:text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "perfil" && <ProfileTab user={user} notify={notify} />}
      {tab === "preferencias" && <PreferencesTab initial={initial} notify={notify} applyLive={setSettings} />}
      {tab === "privacidade" && <PrivacyTab initial={initial} username={user.username} notify={notify} applyLive={setSettings} />}
      {tab === "conta" && <AccountTab user={user} notify={notify} onDeleted={async () => { await logout(); router.push("/"); router.refresh(); }} />}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface rounded-[1.5rem] p-6 sm:p-8">
      <h2 className="text-lg font-black text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

type Notify = (message: string, tone?: "success" | "error" | "info") => void;

function ProfileTab({ user, notify }: { user: ProfileUser; notify: Notify }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl);
  const [saving, setSaving] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Selecione um arquivo de imagem.", "error");
    if (file.size > 6 * 1024 * 1024) return notify("Imagem muito grande (máx. 6MB).", "error");
    try { setAvatar(await fileToSquareDataUrl(file)); } catch { notify("Não foi possível processar a imagem.", "error"); }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() || null, avatarUrl: avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
      notify("Perfil atualizado.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao salvar.", "error");
    } finally { setSaving(false); }
  }

  return (
    <Section title="Seu perfil" description="Como você aparece no FilmJournal.">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {avatar
          ? <img src={avatar} alt="Avatar" className="h-24 w-24 rounded-full border border-white/10 object-cover" />
          : <span className="grid h-24 w-24 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-3xl font-black" style={{ color: "var(--accent)" }}>{initialsOf(displayName || user.username)}</span>}
        <div className="flex flex-wrap gap-3">
          <label className="quiet-button cursor-pointer">
            Enviar imagem
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {avatar && <button type="button" className="text-xs font-bold text-slate-500 hover:text-white" onClick={() => setAvatar(null)}>Remover</button>}
        </div>
      </div>
      <Field label="URL de imagem (opcional)">
        <input className="field" placeholder="https://…" value={avatar && avatar.startsWith("http") ? avatar : ""} onChange={(e) => setAvatar(e.target.value || null)} />
      </Field>
      <Field label="Nome de exibição">
        <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Bio">
        <textarea className="field min-h-24" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Conte um pouco sobre o seu gosto cinematográfico." />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Usuário"><input className="field opacity-60" value={`@${user.username}`} readOnly /></Field>
        <Field label="Membro desde"><input className="field opacity-60" value={user.memberSince} readOnly /></Field>
      </div>
      <button type="button" onClick={save} disabled={saving} className="accent-button disabled:opacity-50">{saving ? "Salvando…" : "Salvar perfil"}</button>
    </Section>
  );
}

function PreferencesTab({ initial, notify, applyLive }: { initial: AppSettings; notify: Notify; applyLive: (s: AppSettings) => void }) {
  const [form, setForm] = useState<AppSettings>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: form.theme, accentColor: form.accentColor, language: form.language, region: form.region,
          dateFormat: form.dateFormat, defaultRatingScale: form.defaultRatingScale, allowHalfStars: form.allowHalfStars,
          showAdultContent: form.showAdultContent, defaultLandingPage: form.defaultLandingPage, emailNotifications: form.emailNotifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
      applyLive(data.settings as AppSettings);
      notify("Preferências salvas.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao salvar.", "error");
    } finally { setSaving(false); }
  }

  return (
    <Section title="Preferências" description="Personalize a aparência e o comportamento do app.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tema">
          <select className="field" value={form.theme} onChange={(e) => set("theme", e.target.value as AppSettings["theme"])}>
            <option value="dark">Escuro</option>
            <option value="system">Sistema</option>
            <option value="light">Claro (beta)</option>
          </select>
        </Field>
        <Field label="Idioma">
          <select className="field" value={form.language} onChange={(e) => set("language", e.target.value as AppSettings["language"])}>
            <option value="pt-BR">Português (BR)</option>
            <option value="en">English</option>
          </select>
        </Field>
      </div>
      <Field label="Cor de destaque">
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((color) => (
            <button key={color} type="button" aria-label={`Cor ${color}`} onClick={() => set("accentColor", color)} className={`h-8 w-8 rounded-full border-2 transition ${form.accentColor.toLowerCase() === color.toLowerCase() ? "border-white" : "border-transparent"}`} style={{ background: color }} />
          ))}
          <input type="color" value={form.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-8 w-10 cursor-pointer rounded bg-transparent" aria-label="Cor personalizada" />
          <button type="button" className="text-xs font-bold text-slate-500 hover:text-white" onClick={() => set("accentColor", DEFAULT_ACCENT)}>Padrão</button>
        </div>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Escala de notas">
          <select className="field" value={form.defaultRatingScale} onChange={(e) => set("defaultRatingScale", Number(e.target.value) === 10 ? 10 : 5)}>
            <option value={5}>5 estrelas</option>
            <option value={10}>10 (0–10)</option>
          </select>
        </Field>
        <Field label="Formato de data">
          <select className="field" value={form.dateFormat} onChange={(e) => set("dateFormat", e.target.value)}>
            <option value="dd/MM/yyyy">dd/MM/aaaa</option>
            <option value="MM/dd/yyyy">MM/dd/aaaa</option>
            <option value="yyyy-MM-dd">aaaa-MM-dd</option>
          </select>
        </Field>
        <Field label="Região (TMDB)"><input className="field" value={form.region} maxLength={8} onChange={(e) => set("region", e.target.value.toUpperCase())} /></Field>
        <Field label="Página inicial padrão">
          <select className="field" value={form.defaultLandingPage} onChange={(e) => set("defaultLandingPage", e.target.value)}>
            <option value="/">Visão Geral</option>
            <option value="/diary">Diário</option>
            <option value="/watchlist">Watchlist</option>
            <option value="/stats">Estatísticas</option>
            <option value="/roulette">Roleta</option>
          </select>
        </Field>
      </div>
      <Toggle label="Permitir meia-estrela nas notas" checked={form.allowHalfStars} onChange={(v) => set("allowHalfStars", v)} />
      <Toggle label="Mostrar conteúdo adulto (TMDB)" checked={form.showAdultContent} onChange={(v) => set("showAdultContent", v)} />
      <Toggle label="Receber notificações por e-mail" checked={form.emailNotifications} onChange={(v) => set("emailNotifications", v)} />
      <button type="button" onClick={save} disabled={saving} className="accent-button disabled:opacity-50">{saving ? "Salvando…" : "Salvar preferências"}</button>
    </Section>
  );
}

function PrivacyTab({ initial, username, notify, applyLive }: { initial: AppSettings; username: string; notify: Notify; applyLive: (s: AppSettings) => void }) {
  const [visibility, setVisibility] = useState(initial.profileVisibility);
  const [saving, setSaving] = useState(false);

  async function save(next: AppSettings["profileVisibility"]) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileVisibility: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao salvar.");
      setVisibility(next);
      applyLive(data.settings as AppSettings);
      notify("Privacidade atualizada.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Falha ao salvar.", "error");
    } finally { setSaving(false); }
  }

  return (
    <Section title="Privacidade" description="Controle quem pode ver seu diário.">
      <Toggle label="Perfil público" description="Quando ativo, qualquer pessoa com o link pode ver seu acervo (somente leitura). Seu e-mail e conta permanecem privados." checked={visibility === "public"} onChange={(v) => save(v ? "public" : "private")} disabled={saving} />
      {visibility === "public" && (
        <div className="surface-subtle rounded-xl p-4 text-sm">
          <p className="text-slate-400">Seu perfil público:</p>
          <Link href={`/u/${username}`} className="mt-1 inline-block font-bold" style={{ color: "var(--accent)" }}>/u/{username} →</Link>
        </div>
      )}
    </Section>
  );
}

function AccountTab({ user, notify, onDeleted }: { user: ProfileUser; notify: Notify; onDeleted: () => void }) {
  const [pw, setPw] = useState({ current: "", next: "" });
  const [emailForm, setEmailForm] = useState({ email: user.email, password: "" });
  const [del, setDel] = useState({ confirm: "", password: "" });
  const [busy, setBusy] = useState<string | null>(null);

  async function post(url: string, body: unknown, method = "POST") {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Falha na operação.");
    return data;
  }

  return (
    <div className="space-y-6">
      <Section title="Alterar senha">
        <Field label="Senha atual"><input type="password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="Nova senha (mín. 8)"><input type="password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <button type="button" disabled={busy !== null} className="accent-button disabled:opacity-50" onClick={async () => {
          setBusy("pw");
          try { await post("/api/account/password", { currentPassword: pw.current, newPassword: pw.next }); notify("Senha atualizada.", "success"); setPw({ current: "", next: "" }); }
          catch (err) { notify(err instanceof Error ? err.message : "Falha.", "error"); } finally { setBusy(null); }
        }}>{busy === "pw" ? "Salvando…" : "Atualizar senha"}</button>
      </Section>

      <Section title="Alterar e-mail">
        <Field label="Novo e-mail"><input type="email" className="field" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} /></Field>
        <Field label="Senha atual"><input type="password" className="field" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} /></Field>
        <button type="button" disabled={busy !== null} className="accent-button disabled:opacity-50" onClick={async () => {
          setBusy("email");
          try { await post("/api/account/email", { email: emailForm.email, currentPassword: emailForm.password }); notify("E-mail atualizado.", "success"); setEmailForm({ ...emailForm, password: "" }); }
          catch (err) { notify(err instanceof Error ? err.message : "Falha.", "error"); } finally { setBusy(null); }
        }}>{busy === "email" ? "Salvando…" : "Atualizar e-mail"}</button>
      </Section>

      {user.role !== "OWNER" && (
        <section className="rounded-[1.5rem] border border-red-500/25 bg-red-500/[0.06] p-6 sm:p-8">
          <h2 className="text-lg font-black text-red-300">Excluir conta</h2>
          <p className="mt-1 text-sm text-slate-400">Remove permanentemente sua conta, seu diário, notas e listas. Esta ação não pode ser desfeita.</p>
          <div className="mt-6 space-y-4">
            <Field label={'Digite "EXCLUIR" para confirmar'}><input className="field" value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} /></Field>
            <Field label="Senha atual"><input type="password" className="field" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} /></Field>
            <button type="button" disabled={busy !== null} className="inline-flex items-center justify-center rounded-full bg-red-500/90 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-500 disabled:opacity-50" onClick={async () => {
              setBusy("del");
              try { await post("/api/account", { confirm: del.confirm, currentPassword: del.password }, "DELETE"); notify("Conta excluída.", "success"); onDeleted(); }
              catch (err) { notify(err instanceof Error ? err.message : "Falha.", "error"); } finally { setBusy(null); }
            }}>{busy === "del" ? "Excluindo…" : "Excluir minha conta"}</button>
          </div>
        </section>
      )}
    </div>
  );
}

function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-[var(--accent)]" : "bg-white/15"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
