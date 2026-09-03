"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

type QuestItem = {
  id: string;
  title: string;
  detail: string;
  track: "marketing" | "technique";
  status: "PENDING" | "DONE";
};

const TRACK_LABELS: Record<string, string> = {
  marketing: "Marketing",
  technique: "Technique",
};

function QuestOfDayCard({
  quest,
  onConfirm,
  loading,
  error,
  onVoirPlus,
  activeIdeaId,
}: {
  quest: QuestItem | undefined;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
  onVoirPlus: () => void;
  activeIdeaId: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {quest ? TRACK_LABELS[quest.track] : ""}
      </div>
      {quest ? (
        <div className="panel" style={{ padding: "18px 18px", border: "1px solid rgba(34,211,238,0.35)" }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--line)" }}>
            Quête du jour · {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, margin: "8px 0" }}>{quest.title}</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)", marginBottom: 14 }}>{quest.detail}</p>

          <button onClick={onConfirm} disabled={loading} className="btn-primary" style={{ width: "100%", marginBottom: 8, fontSize: 13 }}>
            {loading ? "..." : "Confirmer la quête ✓"}
          </button>
          <button onClick={onVoirPlus} className="btn-secondary" style={{ width: "100%", fontSize: 12 }}>
            Voir plus
          </button>
          {error && <div className="error-text">{error}</div>}

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Link href={`/dashboard/ai?idea=${activeIdeaId}&questId=${quest.id}`} style={{ fontSize: 11.5, color: "var(--muted)" }}>
              Toujours pas clair ? Demander à l&apos;IA →
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: "18px 18px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Génération en cours...</p>
        </div>
      )}
    </div>
  );
}

export function AllQuestsClient({
  quests,
  projectTitle,
  activeIdeaId,
  technicalProgress,
}: {
  quests: QuestItem[];
  projectTitle: string;
  activeIdeaId: string;
  technicalProgress: number;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailQuest, setDetailQuest] = useState<QuestItem | null>(null);
  const [listTrack, setListTrack] = useState<"marketing" | "technique">("marketing");
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("Bien joué, quête confirmée ✓");
  // Compteur de confirmations sur cette session — sert uniquement à espacer
  // le petit rappel anti-triche (pas à chaque fois, ça deviendrait lourd et
  // ça sonnerait comme une accusation permanente).
  const [confirmCount, setConfirmCount] = useState(0);
  const HONESTY_REMINDERS = [
    "Sois honnête si tu veux vraiment gagner en efficacité.",
    "Une quête bien faite compte plus qu'une quête vite cochée.",
  ];

  const currentMarketing = quests.find((q) => q.track === "marketing" && q.status === "PENDING");
  const currentTechnique = quests.find((q) => q.track === "technique" && q.status === "PENDING");
  const listQuests = quests.filter((q) => q.track === listTrack);

  async function handleConfirm(quest: QuestItem | undefined) {
    if (!quest) return;
    setLoadingId(quest.id);
    setError(null);
    const res = await fetch("/api/quests/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId: quest.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Une erreur est survenue.");
      setLoadingId(null);
      return;
    }
    const nextCount = confirmCount + 1;
    setConfirmCount(nextCount);
    // Une fois toutes les 3 confirmations environ, plutôt que le message
    // générique.
    setConfirmMessage(
      nextCount % 3 === 0
        ? HONESTY_REMINDERS[Math.floor(Math.random() * HONESTY_REMINDERS.length)]
        : "Bien joué, quête confirmée ✓"
    );
    setJustConfirmed(true);
    setTimeout(() => setJustConfirmed(false), 2500);
    router.refresh();
    setLoadingId(null);
  }

  return (
    <div style={{ width: "100%", maxWidth: 900 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Quêtes — {projectTitle}</h1>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
        3 quêtes marketing + 3 quêtes technique par lot, pour gagner de l&apos;argent le plus vite possible.
      </p>

      <div style={{ marginBottom: 22, maxWidth: 340 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Avancement technique du projet</span>
          <span style={{ fontSize: 11, color: "var(--line)", fontWeight: 600 }}>{technicalProgress}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${technicalProgress}%`,
              background: "linear-gradient(90deg,#67e8f9,#22d3ee)",
              borderRadius: 4,
            }}
          />
        </div>
      </div>

      {justConfirmed && (
        <div
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.35)",
            color: "#4ade80",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          {confirmMessage}
        </div>
      )}

      {/* Quête du jour : une marketing + une technique, côte à côte */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 16, marginBottom: 30 }} className="qod-grid">
        <QuestOfDayCard
          quest={currentMarketing}
          onConfirm={() => handleConfirm(currentMarketing)}
          loading={loadingId === currentMarketing?.id}
          error={error}
          onVoirPlus={() => currentMarketing && setDetailQuest(currentMarketing)}
          activeIdeaId={activeIdeaId}
        />
        <QuestOfDayCard
          quest={currentTechnique}
          onConfirm={() => handleConfirm(currentTechnique)}
          loading={loadingId === currentTechnique?.id}
          error={error}
          onVoirPlus={() => currentTechnique && setDetailQuest(currentTechnique)}
          activeIdeaId={activeIdeaId}
        />
      </div>

      {/* Quête totale : bouton Marketing / Technique en haut */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Quête totale
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {(["marketing", "technique"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setListTrack(t)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 12.5,
                cursor: "pointer",
                background: listTrack === t ? "linear-gradient(90deg, var(--line), var(--line2))" : "transparent",
                color: listTrack === t ? "#06111a" : "var(--muted)",
                fontWeight: listTrack === t ? 600 : 400,
              }}
            >
              {TRACK_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        {listQuests.map((q, i) => (
          <div
            key={q.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 16px",
              borderBottom: i === listQuests.length - 1 ? "none" : "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 14, color: q.status === "DONE" ? "#4ade80" : "var(--muted)" }}>
              {q.status === "DONE" ? "✓" : "○"}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 13.5,
                textDecoration: q.status === "DONE" ? "line-through" : "none",
                color:
                  q.status === "DONE"
                    ? "#4ade80"
                    : q.id === currentMarketing?.id || q.id === currentTechnique?.id
                    ? "var(--line)"
                    : "var(--text)",
              }}
            >
              {q.title}
            </span>
            {/* Confirmer directement depuis le tableau — pas besoin d'attendre que ce
                soit "la" quête du jour affichée en haut, pour ceux qui ont plus de temps. */}
            {q.status === "PENDING" && (
              <button
                onClick={() => handleConfirm(q)}
                disabled={loadingId === q.id}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--success)",
                  fontSize: 11,
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                {loadingId === q.id ? "..." : "Confirmer"}
              </button>
            )}
            <button
              onClick={() => setDetailQuest(q)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontSize: 11.5,
                textDecoration: "underline",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Voir plus
            </button>
          </div>
        ))}
        {listQuests.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>Aucune quête pour l&apos;instant.</div>
        )}
      </div>

      {/* Panneau de détail — même page, pas de changement de route */}
      {detailQuest && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "var(--overlay)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflowY: "auto",
            padding: "24px 20px 60px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 560 }}>
            <button onClick={() => setDetailQuest(null)} className="btn-secondary" style={{ marginBottom: 22 }}>
              ← Retour aux quêtes
            </button>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>
              {TRACK_LABELS[detailQuest.track]}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18, lineHeight: 1.3 }}>{detailQuest.title}</h2>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "#e2e8f0", whiteSpace: "pre-line", marginBottom: 24 }}>
              {detailQuest.detail}
            </p>
            <Link href={`/dashboard/ai?idea=${activeIdeaId}&questId=${detailQuest.id}`} className="btn-secondary" style={{ fontSize: 12.5 }}>
              Toujours pas clair ? Demander à l&apos;IA →
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 600px) {
          .qod-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
