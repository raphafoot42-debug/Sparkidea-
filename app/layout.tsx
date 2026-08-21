import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Spark Idea — Ton idée, ta destinée",
  description:
    "Décris ton idée de projet, obtiens un plan précis pour la lancer.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode; 
}) {
  // Thème lu ici (côté serveur) pour éviter le flash "sombre puis clair" au
  // chargement — appliqué directement sur <html> avant le premier rendu.
  const user = await getCurrentUser().catch(() => null);
  const theme = user?.theme === "light" ? "light" : "dark";

  return (
    <html lang="fr" data-theme={theme}>
      <head>
        {/* Police d'icônes Tabler — utilisée sur les nœuds du schéma (MindMap.tsx) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
