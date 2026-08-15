"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TRIAL_MESSAGE_LIMIT, trialMsRemaining, trialMessagesRemaining } from "@/lib/trial";

type Props = {
  trialStartedAt: Date | null;
  trialMessagesUsed: number;
};

// Affiché uniquement pour un utilisateur en essai gratuit (subscriptionStatus
// === "TRIAL") — le composant appelant est responsable de ce check, pour
// éviter un import inutile de lib/trial côté pages qui ne l'utilisent pas.
// Client Component : le temps restant descend en direct (mis à jour chaque
// minute), pas juste calculé une fois au chargement de la page.
export function TrialBanner({ trialStartedAt, trialMessagesUsed }: Props) {
  const [msLeft, setMsLeft] = useState(() => trialMsRemaining({ trialStartedAt }));

  useEffect(() => {
    const interval = setInterval(() => {
      setMsLeft(trialMsRemaining({ trialStartedAt }));
    }, 60_000);
    return () => clearInterval(interval);
  }, [trialStartedAt]);

  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  const minutesLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
  const messagesLeft = trialMessagesRemaining(trialMessagesUsed);
  const urgent = msLeft < 2 * 60 * 60 * 1000; // moins de 2h restantes

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 18px",
        marginBottom: 20,
        fontSize: 13,
        border: `1px solid ${urgent ? "rgba(244,63,94,0.45)" : "rgba(240,153,123,0.35)"}`,
      }}
    >
      <span style={{ color: "var(--muted)" }}>
        Essai gratuit — <strong style={{ color: urgent ? "var(--danger)" : "var(--text)" }}>
          {hoursLeft}h{String(minutesLeft).padStart(2, "0")}
        </strong>{" "}
        restantes, <strong style={{ color: "var(--text)" }}>{messagesLeft}</strong>/{TRIAL_MESSAGE_LIMIT} message
        {messagesLeft > 1 ? "s" : ""} IA restant{messagesLeft > 1 ? "s" : ""}
      </span>
      <Link href="/pricing" className="btn-secondary" style={{ borderRadius: 20, fontSize: 12.5 }}>
        Passer à un forfait →
      </Link>
    </div>
  );
}
