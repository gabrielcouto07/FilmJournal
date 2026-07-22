"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";

type Tab = "login" | "register";

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("login");

  // Abre o cadastro quando a página pública envia `?tab=register`.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "register") setTab("register");
  }, []);

  // Dados do login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Dados do cadastro
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const { notify } = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await login(username, password);
      notify("Bem-vindo de volta! 👋", "success");
      router.push("/"); router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Credenciais inválidas.");
      notify("Credenciais inválidas.", "error");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          ...(regName.trim() ? { displayName: regName.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta.");
      notify("Conta criada! Entrando...", "success");
      await login(regUsername, regPassword);
      router.push("/"); router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível criar a conta.";
      setError(message);
      notify(message, "error");
    } finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm font-semibold text-white placeholder-slate-600 transition-all duration-200 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300 focus:scale-[1.01]";

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <div className="surface fade-up relative w-full max-w-md overflow-hidden rounded-[2rem] p-8 sm:p-10 border border-white/[0.05]">
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-amber-500/10 blur-[50px]" />

        <div className="relative">
          {/* Marca */}
          <div className="flex justify-center mb-6">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10">
              <span className="h-3.5 w-3.5 rounded-full bg-amber-300 shadow-[0_0_15px_rgb(var(--accent-300)/0.95)]" />
            </span>
          </div>

          {/* Abas */}
          <div className="flex rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 mb-8">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition duration-200 ${tab === t ? "bg-amber-300 text-[#1a1400] shadow-[0_4px_16px_rgb(var(--accent-300)/0.2)]" : "text-slate-500 hover:text-white"}`}
              >
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="mb-6 animate-[fade-up_.25s_ease_both] rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-300">
              {error}
            </div>
          )}

          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="login-username" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Usuário</label>
                <input id="login-username" name="username" type="text" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className={inputClass} placeholder="seu_usuario" />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Senha</label>
                <input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} placeholder="- - - - - - - - " />
              </div>
              <button type="submit" disabled={loading} className={`w-full accent-button py-4 justify-center font-bold disabled:opacity-50 ${!loading ? "glow-pulse" : ""}`}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="register-name" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Nome de exibição</label>
                <input id="register-name" name="name" type="text" autoComplete="name" value={regName} onChange={e => setRegName(e.target.value)} className={inputClass} placeholder="Seu nome" />
              </div>
              <div>
                <label htmlFor="register-username" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Usuário</label>
                <input id="register-username" name="username" type="text" autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" value={regUsername} onChange={e => setRegUsername(e.target.value)} className={inputClass} placeholder="letras, números, _" />
              </div>
              <div>
                <label htmlFor="register-email" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">E-mail</label>
                <input id="register-email" name="email" type="email" autoComplete="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} className={inputClass} placeholder="voce@email.com" />
              </div>
              <div>
                <label htmlFor="register-password" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Senha (mín. 8 caracteres)</label>
                <input id="register-password" name="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={regPassword} onChange={e => setRegPassword(e.target.value)} className={inputClass} placeholder="- - - - - - - - " />
              </div>
              <button type="submit" disabled={loading} className={`w-full accent-button py-4 justify-center font-bold disabled:opacity-50 ${!loading ? "glow-pulse" : ""}`}>
                {loading ? "Criando conta..." : "Criar conta"}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <Link href="/" className="text-xs font-bold text-slate-600 hover:text-amber-300 transition">← Voltar</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
