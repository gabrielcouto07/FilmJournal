"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

// New IA: Diário (journal) · Paladar (dashboard) · Descobrir (blind spots) ·
// Jogar (games) · Roleta. Descobrir/Jogar entries land with their pages.
// /watchlist, /favorites, /stats and /search stay routable via the overview
// page and quick search — they just lose their top-nav slots.
const navigation = [
  { href: "/diary", label: "Diário" },
  { href: "/dashboard", label: "Paladar" },
  { href: "/discover", label: "Descobrir" },
  { href: "/roulette", label: "Roleta" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0a0a0a]/82 backdrop-blur-2xl">
    <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-4 px-4 sm:px-7 lg:px-10">
      <Link href="/" className="mr-auto flex shrink-0 items-center gap-2.5" aria-label="FilmJournal home">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10"><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_15px_rgba(245,197,24,.95)]" /></span>
        <span className="hidden text-sm font-black tracking-[0.16em] text-white sm:block">FILMJOURNAL</span>
      </Link>
      <nav className="hidden items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.025] p-1 lg:flex" aria-label="Primary navigation">
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${active ? "bg-amber-300 text-[#1a1400]" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>{item.label}</Link>;
        })}
      </nav>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => window.dispatchEvent(new Event("open-command-palette"))} className="quiet-button gap-2 !px-3 !py-2" aria-label="Abrir busca rápida"><span aria-hidden="true">⌕</span><span className="hidden sm:inline">Busca rápida</span><kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-500 md:inline">⌘K</kbd></button>
        {user ? (
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/profile" className={`text-xs font-bold transition ${pathname.startsWith("/profile") ? "text-amber-300" : "text-slate-500 hover:text-white"}`}>{user.displayName || user.username}</Link>
            {user.role === "OWNER" && <Link href="/admin" className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${pathname.startsWith("/admin") ? "bg-amber-300 text-[#1a1400]" : "text-amber-300 hover:bg-amber-300/10"}`}>Admin</Link>}
            <button onClick={() => logout()} className="rounded-full px-3.5 py-1.5 text-xs font-bold border border-white/[0.07] bg-white/[0.025] text-slate-400 hover:bg-white/[0.05] hover:text-white transition">Sair</button>
          </div>
        ) : (
          <Link href="/login" className="hidden lg:block rounded-full px-3.5 py-1.5 text-xs font-bold bg-amber-300/10 border border-amber-300/30 text-amber-300 hover:bg-amber-300/20 transition">Entrar</Link>
        )}
      </div>
    </div>
    <nav className="rail flex gap-1 items-center justify-between border-t border-white/[0.05] px-3 py-2 lg:hidden" aria-label="Mobile navigation">
      <div className="flex gap-1 overflow-x-auto">
        {navigation.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-amber-300 text-black" : "text-slate-400"}`}>{item.label}</Link>;
        })}
      </div>
      <div className="shrink-0 border-l border-white/10 pl-2">
        {user ? (
          <div className="flex items-center gap-1"><Link href="/profile" className={`rounded-full px-3 py-1.5 text-xs font-bold ${pathname.startsWith("/profile") ? "bg-amber-300 text-black" : "text-amber-300"}`}>Perfil</Link><button onClick={() => logout()} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-400">Sair</button></div>
        ) : (
          <Link href="/login" className="rounded-full px-3 py-1.5 text-xs font-bold text-amber-300">Entrar</Link>
        )}
      </div>
    </nav>
  </header>;
}
