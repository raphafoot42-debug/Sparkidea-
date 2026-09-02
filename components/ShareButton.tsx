"use client";

import { useState } from "react";

// Bouton "Partager mon analyse" — génère (ou récupère) le lien public en
// lecture seule via /api/ideas/share, puis tente de le copier dans le
// presse-papier. Safari (iPhone/iPad) refuse souvent la copie automatique
// après un appel réseau (le geste utilisateur est considéré "trop vieux") —
// dans ce cas on affiche le lien à l'écran pour une copie manuelle, au lieu
// d'afficher une simple erreur qui cache que le lien existe bel et bien.
export function ShareButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "manual" | "error">("idle");
  const [link, setLink] = useState<string | null>(null);

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
      setLink(url);

      try {
        await navigator.clipboard.writeText(url);
        setStatus("copied");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        // Le lien existe bel et bien, seule la copie auto a échoué (Safari) —
        // on le montre pour une copie manuelle plutôt que de faire croire à
        // un échec complet.
        setStatus("manual");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={handleShare} className="btn-secondary" style={{ borderRadius: 20, fontSize: 12.5 }} disabled={status === "loading"}>
        {status === "loading" && "Un instant..."}
        {status === "copied" && "Lien copié ✓"}
        {status === "error" && "Erreur, réessaie"}
        {(status === "idle" || status === "manual") && "Partager mon analyse"}
      </button>

      {status === "manual" && link && (
        <div
          className="panel"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 20,
            padding: 10,
            minWidth: 240,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
            Copie manuellement ton lien :
          </div>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="field-input"
            style={{ fontSize: 12, width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
