import type { CSSProperties, ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import AppProviders from "@/components/AppProviders";
import PageTransition from "@/components/PageTransition";
import { apiGet, getSessionUser } from "@/lib/api-server";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata = {
  title: "FilmJournal",
  description: "A cinematic private film journal.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Carrega tema e cor no servidor para evitar uma troca visual ao abrir a página.
  const session = await getSessionUser();
  let settings = DEFAULT_SETTINGS;
  let avatarUrl: string | null = null;

  if (session) {
    // Uma falha na API não pode derrubar o app: cai nos padrões e segue.
    const [settingsResult, profileResult] = await Promise.allSettled([
      apiGet<{ settings: AppSettings }>("/settings"),
      apiGet<{ user: { avatarUrl: string | null } }>("/profile"),
    ]);
    if (settingsResult.status === "fulfilled") settings = settingsResult.value.settings;
    if (profileResult.status === "fulfilled") avatarUrl = profileResult.value.user.avatarUrl;
  }

  const initialTheme = settings.theme === "light" ? "light" : "dark";
  const rootStyle = { colorScheme: initialTheme, "--accent": settings.accentColor } as CSSProperties;

  return (
    <html
      lang={settings.language === "en" ? "en" : "pt-BR"}
      data-theme={initialTheme}
      style={rootStyle}
      className={`${inter.variable} ${playfair.variable}`}
    >
      <body>
        <AppProviders initialSettings={settings} initialUser={session}>
          <SiteHeader avatarUrl={avatarUrl} />
          <PageTransition>{children}</PageTransition>
        </AppProviders>
      </body>
    </html>
  );
}
