"use client";

import { useEffect, useState } from "react";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { PricingPlans } from "@/components/PricingPlans";
import type { BillingInterval, PlanKey } from "@/lib/plan-limits";
import { TRIAL_REFUSED_MESSAGE } from "@/lib/trial-guard-messages";

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);

  // Lecture directe de l'URL (pas useSearchParams, qui impose un <Suspense>).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTrialUsed(params.get("trial") === "used");
    const refund = params.get("refund");
    if (refund === "error") {
      setRefundNotice("Ton abonnement est résilié, mais le remboursement automatique a rencontré un problème. Contacte-nous : on te rembourse manuellement.");
    } else if (refund && Number(refund) > 0) {
      const euros = (Number(refund) / 100).toFixed(2).replace(".", ",");
      setRefundNotice(`Ton abonnement est résilié. Un remboursement de ${euros} € a été émis : il arrive sur ta carte sous quelques jours.`);
    }
  }, []);

  async function handleChoose(plan: PlanKey, interval: BillingInterval) {
    setLoadingPlan(plan);
    setError(null);

    // Tout est entouré d'un try/catch/finally : quoi qu'il arrive (panne
    // réseau, réponse non-JSON, erreur serveur inattendue), le bouton ne
    // doit plus jamais rester bloqué indéfiniment sur "...".
    try {
      const raw = sessionStorage.getItem("spark_pending_schema");
      const pending = raw ? JSON.parse(raw) : null;

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          interval,
          ...(pending ? { pendingIdea: { rawInput: pending.rawInput, schemaData: pending.schema } } : {}),
        }),
      });

      let data: { url?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Le serveur a renvoyé une réponse qui n'est pas du JSON valide
        // (page d'erreur générique par exemple) — on traite ça comme une
        // erreur propre plutôt que de planter silencieusement.
      }

      if (!res.ok || !data.url) {
        setError(data.error ?? "Impossible de démarrer le paiement, réessaie dans un instant.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Impossible de contacter le serveur, vérifie ta connexion et réessaie.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
      <AnimatedGrid intensity="discrete" />

      <div style={{ position: "relative", zIndex: 2, textAlign: "center", marginBottom: 26 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>Choisis ton forfait</h1>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Ton idée est prête. Passe à l&apos;étape suivante.</div>
      </div>

      {refundNotice && (
        <div
          className="panel"
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 560,
            padding: "12px 18px",
            marginBottom: 24,
            fontSize: 13,
            lineHeight: 1.55,
            textAlign: "center",
          }}
        >
          {refundNotice}
        </div>
      )}

      {trialUsed && (
        <div
          className="panel"
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 560,
            padding: "12px 18px",
            marginBottom: 24,
            fontSize: 13,
            lineHeight: 1.55,
            textAlign: "center",
            border: "1px solid rgba(244,63,94,0.45)",
          }}
        >
          {TRIAL_REFUSED_MESSAGE}
        </div>
      )}

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1000 }}>
        <PricingPlans mode="buy" onChoose={handleChoose} loadingPlan={loadingPlan} />
      </div>

      {error && (
        <div style={{ position: "relative", zIndex: 2, marginTop: 20, textAlign: "center" }}>
          <div className="error-text">{error}</div>
        </div>
      )}
    </div>
  );
}
