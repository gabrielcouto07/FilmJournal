import type { ReactNode } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import AppProviders from "@/components/AppProviders";
import PageTransition from "@/components/PageTransition";

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

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <AppProviders>
          <SiteHeader />
          <PageTransition>{children}</PageTransition>
        </AppProviders>
      </body>
    </html>
  );
}
