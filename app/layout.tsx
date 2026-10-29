import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Aggregator Dashboard",
  description:
    "Tableau de bord agrégateur : REST Countries, Open-Meteo et World Bank — Next.js, Prisma, PostgreSQL, Recharts."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
