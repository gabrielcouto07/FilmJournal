import type { CSSProperties, ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import AppProviders from "@/components/AppProviders";
import PageTransition from "@/components/PageTransition";
import { getCurrentUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";

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
  // Read the viewer's settings server-side so theme/accent apply without a flash.
  const user = await getCurrentUser();
  const settings = await getUserSettings(user?.id);
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
        <AppProviders initialSettings={settings}>
          <SiteHeader />
          <PageTransition>{children}</PageTransition>
        </AppProviders>
      </body>
    </html>
  );
}
