"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GoalOnboarding({ ideaId, projectTitle }: { ideaId: string; projectTitle: string }) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [targetMetric, setTargetMetric] = useState<"clients" | "revenue" | "audience" | "">("");
  const [targetValue, setTargetValue] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState<"visage" | "anonyme" | "ia_generee" | "pas_decide" | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit() {
    if (goal.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    const numericValue = Number(targetValue);
    const res = await fetch("/api/ideas/set-goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideaId,
        goal: goal.trim(),
        ...(targetMetric && numericValue > 0 ? { targetMetric, targetValue: numericValue } : {}),
        ...(communicationStyle ? { communicationStyle } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur, réessaie.");
      return;
    }
    setFeedback(data.feedback);
  }

  return (
    <div className="panel" style={{ width: "100%", maxWidth: 560, padding: "28px 24px" }}>
      {!feedback ? (
        <>
          <div style={{ fontSize: 13, color: "var(--line)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Bienvenue</div>
          <h1 style={{ fontSize: 19, fontWeight: 600, marginBottom: 10, lineHeight: 1.35 }}>
            Je suis là pour t&apos;aider à faire avancer <em>{projectTitle}</em>. Avant de commencer :
          </h1>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Quel est ton but final avec ce projet ?</p>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex : avoir 1000 abonnés engagés sur TikTok et signer mon premier client payant d'ici 3 mois..."
            className="field-input"
            rows={4}
            style={{ width: "100%", resize: "vertical", marginBottom: 6 }}
          />
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
            Sois précis si tu peux : combien d&apos;abonnés, de clients, de revenu — ça aide à te donner des quêtes vraiment utiles.
          </p>

          <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
            Objectif chiffré <span style={{ opacity: 0.6, fontWeight: 400 }}>(optionnel, mais recommandé — sert à calculer ta vraie progression)</span>
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <select
              value={targetMetric}
              onChange={(e) => setTargetMetric(e.target.value as typeof targetMetric)}
              className="field-input"
              style={{ flex: 1 }}
            >
              <option value="">Choisis une métrique</option>
              <option value="clients">Clients</option>
              <option value="revenue">Revenu (€)</option>
              <option value="audience">Audience</option>
            </select>
            <input
              type="number"
              min={1}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Ex : 100"
              className="field-input"
              style={{ width: 110 }}
            />
          </div>

          <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
            Pour le contenu marketing <span style={{ opacity: 0.6, fontWeight: 400 }}>(optionnel — pour ne jamais te proposer un format qui ne te convient pas)</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
            {[
              { value: "visage" as const, label: "Je suis à l'aise pour apparaître en vidéo" },
              { value: "anonyme" as const, label: "Je préfère rester anonyme (voix, écran, texte)" },
              { value: "ia_generee" as const, label: "Je préfère du contenu généré par IA (avatar, voix IA)" },
              { value: "pas_decide" as const, label: "Je n'ai pas encore décidé" },
            ].map((opt) => (
              <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="communicationStyle"
                  checked={communicationStyle === opt.value}
                  onChange={() => setCommunicationStyle(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
          <button onClick={submit} disabled={busy} className="btn-primary" style={{ width: "100%" }}>
            {busy ? "..." : "Valider mon but"}
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--line)", marginBottom: 10 }}>Ton but</div>
          <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 18, fontStyle: "italic", color: "var(--muted)" }}>
            « {goal} »
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 22 }}>{feedback}</p>
          <button onClick={() => router.refresh()} className="btn-primary" style={{ width: "100%" }}>
            C&apos;est parti →
          </button>
        </>
      )}
    </div>
  );
}
