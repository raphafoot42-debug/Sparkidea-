"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Goal = {
  id: string;
  text: string;
};

export function GoalStrip({
  ideaId,
  goals,
}: {
  ideaId: string;
  goals: Goal[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{
    mode: "create" | "update";
    goalId?: string;
    value: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeGoal = goals[0];

  function openCreate() {
    setError(null);
    setReason("");
    setModal({ mode: "create", value: "" });
  }

  function openUpdate(goal: Goal) {
    setError(null);
    setReason("");
    setModal({ mode: "update", goalId: goal.id, value: goal.text });
  }

  async function saveGoal() {
    if (!modal || modal.value.trim().length < 3 || busy) return;
    if (modal.mode === "update" && reason.trim().length < 8) {
      setError("Explique en quelques mots pourquoi tu dois modifier cet objectif.");
      return;
    }

    setBusy(true);
    setError(null);
    const res = await fetch("/api/ideas/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: modal.mode,
        ideaId,
        goal: modal.value.trim(),
        ...(modal.mode === "update"
          ? { goalId: modal.goalId, reason: reason.trim() }
          : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) {
      setError(data?.error ?? "Impossible d'enregistrer cet objectif.");
      return;
    }

    setModal(null);
    router.refresh();
  }

  return (
    <>
      <section
        className="goal-strip"
        aria-label="Objectifs du projet"
        style={{
          width: "100%",
          maxWidth: 900,
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(34, 211, 238, 0.35)",
          borderRadius: 16,
          padding: "16px 18px",
          background:
            "linear-gradient(105deg, rgba(34,211,238,0.1), rgba(168,85,247,0.1) 60%, rgba(11,14,20,0.94))",
          boxShadow: "0 16px 38px rgba(0,0,0,0.16)",
        }}
      >
        <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--line)", marginBottom: 8 }}>
          Ton objectif
        </div>

        {activeGoal ? (
          <>
            <div style={{ fontSize: 16, lineHeight: 1.45, fontWeight: 650, maxWidth: "calc(100% - 88px)", paddingRight: 8 }}>
              {activeGoal.text}
            </div>
            {goals.length > 1 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {goals.map((goal, index) => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => openUpdate(goal)}
                    className="goal-chip"
                    title={goal.text}
                  >
                    {index + 1}. {goal.text}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 13, flexWrap: "wrap" }}>
              <button type="button" className="btn-secondary" style={{ fontSize: 11.5, padding: "7px 11px" }} onClick={() => openUpdate(activeGoal)}>
                Modifier
              </button>
              {goals.length < 3 ? (
                <button type="button" className="btn-secondary" style={{ fontSize: 11.5, padding: "7px 11px" }} onClick={openCreate}>
                  + Ajouter un objectif
                </button>
              ) : (
                <span style={{ fontSize: 11.5, color: "var(--muted)", alignSelf: "center" }}>
                  3 objectifs maximum : reste concentré pour réussir.
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5 }}>Fixe le cap de ton projet</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
              Tes quêtes seront choisies autour de cet objectif.
            </div>
            <button type="button" className="btn-primary" style={{ fontSize: 12 }} onClick={openCreate}>
              Définir mon objectif
            </button>
          </>
        )}
      </section>

      {modal && (
        <div className="goal-modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <div className="goal-modal panel" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Fermer" className="goal-modal-close" onClick={() => setModal(null)}>×</button>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--line)", marginBottom: 8 }}>
              {modal.mode === "create" ? "Nouvel objectif" : "Modifier l'objectif"}
            </div>
            <h2 id="goal-modal-title" style={{ fontSize: 19, marginBottom: 8 }}>
              {modal.mode === "create" ? "Quel cap veux-tu garder en tête ?" : "Pourquoi ce changement est nécessaire ?"}
            </h2>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)", marginBottom: 16 }}>
              {modal.mode === "create"
                ? "Un objectif clair aide l'IA à choisir les quêtes les plus importantes, dans le bon ordre."
                : "On ne change pas de cap sur un coup de tête : une raison permet de garder une progression cohérente."}
            </p>
            <textarea
              className="field-input"
              rows={4}
              value={modal.value}
              onChange={(event) => setModal({ ...modal, value: event.target.value })}
              placeholder="Ex : signer mes 3 premiers clients d'ici 90 jours"
              style={{ resize: "vertical", marginBottom: 12 }}
              autoFocus
            />
            {modal.mode === "update" && (
              <textarea
                className="field-input"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex : mon offre a changé après les premiers retours clients..."
                style={{ resize: "vertical", marginBottom: 12 }}
              />
            )}
            {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
            <button type="button" className="btn-primary" onClick={saveGoal} disabled={busy || modal.value.trim().length < 3} style={{ width: "100%" }}>
              {busy ? "L'IA analyse ton objectif..." : "Valider l'objectif"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
