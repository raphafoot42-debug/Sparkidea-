"use client";

import { useState } from "react";

// Bouton "Partager mon analyse" — génère (ou récupère) le lien public en
// lecture seule via /api/ideas/share, puis le copie dans le presse-papier.
export function ShareButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");

  async function handleShare() {
    setStatus("loading");
    try {
      const res = await fetch("/api/ideas/share", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const url = `${window.location.origin}/share/${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <button onClick={handleShare} className="btn-secondary" style={{ borderRadius: 20, fontSize: 12.5 }} disabled={status === "loading"}>
      {status === "loading" && "Un instant..."}
      {status === "copied" && "Lien copié ✓"}
      {status === "error" && "Erreur, réessaie"}
      {status === "idle" && "Partager mon analyse"}
    </button>
  );
}
