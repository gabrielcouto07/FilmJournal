"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const { notify } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(username, password);
      notify("Bem-vindo de volta!", "success");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Falha ao entrar. Verifique suas credenciais.");
      notify("Falha no login.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4">
      <div className="surface relative w-full max-w-md overflow-hidden rounded-[2rem] p-8 sm:p-10 border border-white/[0.05]">
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-amber-500/10 blur-[50px]" />
        
        <div className="relative">
          <div className="flex justify-center mb-6">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10">
              <span className="h-3.5 w-3.5 rounded-full bg-amber-300 shadow-[0_0_15px_rgba(245,197,24,.95)]" />
            </span>
          </div>

          <h1 className="text-center text-3xl font-black tracking-tight text-white mb-2">
            Acesso do Proprietário
          </h1>
          <p className="text-center text-sm text-slate-500 mb-8">
            Entre para gerenciar seu Film Journal.
          </p>

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm font-semibold text-white placeholder-slate-600 transition focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300"
                placeholder="Digite o nome de usuário"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm font-semibold text-white placeholder-slate-600 transition focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full accent-button py-4 text-center justify-center font-bold disabled:opacity-50"
            >
              {loading ? "Autenticando..." : "Acessar Journal"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/" className="text-xs font-bold text-slate-600 hover:text-amber-300 transition">
              ← Voltar à galeria pública
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
