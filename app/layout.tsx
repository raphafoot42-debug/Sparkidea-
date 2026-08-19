import React from "react";

export const metadata = {
  title: "Lexora - AffiniX",
  description: "Plateforme d'affiliation Lexora",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#05070d" }}>
        {children}
      </body>
    </html>
  );
}
