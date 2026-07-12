import type { ReactNode } from "react";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  title: "Reel Archive",
  description: "A private movie journal.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
