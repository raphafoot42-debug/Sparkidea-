"use client";

import { useState } from "react";
import Link from "next/link"; 

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Quêtes", href: "/dashboard/quests" },
  { label: "IA", href: "/dashboard/ai" },
  { label: "Analyse", href: "/dashboard/analyse" },
  { label: "Historique", href: "/dashboard/ideas" },
];

// Un seul et même pattern de navigation sur mobile ET desktop, décidé pour
// laisser toute la largeur de l'écran au contenu (pas de sidebar fixe qui
// bouffe de la place en permanence).
export function DrawerNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
          }}
        >
          ☰
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          width: 240,
          background: "var(--panel)",
          borderRight: "1px solid var(--border)",
          padding: "18px 14px",
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 24, paddingLeft: 6 }}>
          ◆ Spark Idea
        </div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            style={{
              padding: "12px 10px",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--muted)",
              marginBottom: 2,
            }}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/dashboard/settings"
          onClick={() => setOpen(false)}
          style={{
            marginTop: "auto",
            padding: "12px 10px",
            borderRadius: 8,
            fontSize: 14,
            color: "var(--muted)",
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
          }}
        >
          Paramètres
        </Link>
      </div>
    </>
  );
}
