"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
 
type Suggestion = { title: string; pitch: string };

// N'apparaît QUE si le projet est à 100% (vérifié côté serveur avant de
// monter ce composant — voir app/dashboard/page.tsx). Rien n'est jamais
// réinitialisé : le schéma, l'historique et les quêtes déjà faites restent
// intacts, on ajoute juste un nouveau palier au même projet.
export function PrestigeClient({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [customText, setCustomText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPrestige() {
    setOpen(true);
    if (suggestions) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/ideas/prestige?ideaId=${ideaId}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur, réessaie.");
      return;
    }
    setSuggestions(data.suggestions);
  }

  function pick(s: Suggestion) {
    setPicked(s);
    setCustomText(s.title + " — " + s.pitch);
  }

  async function confirm() {
    if (!customText.trim() || confirming) return;
    setConfirming(true);
    setError(null);
    const res = await fetch("/api/ideas/prestige", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaId, goal: customText.trim() }),
    });
    const data = await res.json();
    setConfirming(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur, réessaie.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={openPrestige}
        className="btn-primary"
        style={{
          marginTop: 16,
          background: "linear-gradient(135deg,#22d3ee,#a855f7)",
          border: "none",
        }}
      >
        🏆 Objectif atteint — passer au niveau suivant →
      </button>
    );
  }

  return (
    <div className="panel" style={{ width: "100%", maxWidth: 600, padding: "24px 22px", marginTop: 16 }}>
      <div style={{ fontSize: 13, color: "var(--line)", marginBottom: 6 }}>🏆 Prestige</div>
      <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 14 }}>
        Tu as atteint ton objectif. Voici trois façons de gagner encore plus avec ce même projet :
      </h2>

      {loading && <p style={{ fontSize: 13, color: "var(--muted)" }}>Génération des prochains objectifs...</p>}
      {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

      {suggestions && !picked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => pick(s)}
              className="panel"
              style={{ textAlign: "left", padding: "14px 16px", cursor: "pointer" }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{s.pitch}</div>
            </button>
          ))}
        </div>
      )}

      {picked && (
        <>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            Reformule si besoin, c&apos;est ce texte qui devient ton nouvel objectif :
          </p>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="field-input"
            rows={3}
            style={{ width: "100%", resize: "vertical", marginBottom: 14 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setPicked(null)} className="btn-secondary" style={{ flex: 1 }}>
              ← Autre choix
            </button>
            <button onClick={confirm} disabled={confirming} className="btn-primary" style={{ flex: 1 }}>
              {confirming ? "..." : "Confirmer →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
