"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/diary", label: "Diary" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/favorites", label: "Top 10" },
  { href: "/search", label: "Discover" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#090b0a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2" aria-label="Reel Archive home">
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(119,242,161,.9)]" />
          <span className="text-sm font-black tracking-[0.18em] text-white">REEL ARCHIVE</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 ${active ? "bg-emerald-300 text-[#0b120e]" : "text-slate-400 hover:text-white"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
