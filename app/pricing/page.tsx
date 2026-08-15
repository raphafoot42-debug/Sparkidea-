"use client";

import { useState } from "react";
import { AnimatedGrid } from "@/components/AnimatedGrid";

const PLANS = [
  {
    id: "STARTER" as const,
    name: "Starter",
    price: "9€",
    features: ["1 idée active", "Schéma complet + carte mentale", "30 messages IA / mois"],
    highlight: false,
  },
  {
    id: "PRO" as const,
    name: "Pro",
    price: "24€",
    features: [
      "Jusqu'à 5 idées actives",
      "Schéma complet + carte mentale",
      "Export PDF",
      "50 messages IA / mois",
    ],
    highlight: true,
  },
  {
    id: "STUDIO" as const,
    name: "Élite",
    price: "74€",
    features: [
      "Jusqu'à 15 idées actives",
      "Suivi complet dans le temps + historique",
      "Export PDF",
      "150 messages IA / mois",
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(plan: "STARTER" | "PRO" | "STUDIO") {
    setLoadingPlan(plan);
    setError(null);

    // L'idée générée gratuitement était en sessionStorage depuis l'accueil —
    // mais elle est optionnelle : un utilisateur qui s'inscrit directement
    // (sans passer par l'analyse gratuite) doit pouvoir payer quand même.
    const raw = sessionStorage.getItem("spark_pending_schema");
    const pending = raw ? JSON.parse(raw) : null;

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        ...(pending ? { pendingIdea: { rawInput: pending.rawInput, schemaData: pending.schema } } : {}),
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.url) {
      setError(data.error ?? "Impossible de démarrer le paiement.");
      setLoadingPlan(null);
      return;
    }

    window.location.href = data.url; // redirection vers Stripe Checkout
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGrid intensity="discrete" />

      <div style={{ position: "relative", zIndex: 2, textAlign: "center", marginBottom: 34 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6 }}>Choisis ton forfait</h1>
        <div style={{ color: "var(--muted)", fontSize: 13 }}>Ton idée est prête. Passe à l&apos;étape suivante.</div>
      </div>

      <div style={{ position: "relative", zIndex: 2, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="panel"
            style={{
              width: 260,
              padding: "26px 24px",
              position: "relative",
              borderColor: plan.highlight ? "rgba(34,211,238,0.4)" : undefined,
              boxShadow: plan.highlight ? "0 0 30px rgba(34,211,238,0.08)" : undefined,
            }}
          >
            {plan.highlight && (
              <div
                style={{
                  position: "absolute",
                  top: -11,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(90deg, var(--line), var(--line2))",
                  color: "#05070a",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 20,
                }}
              >
                Le plus populaire
              </div>
            )}
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{plan.name}</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>
              {plan.price} <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>/ mois</span>
            </div>
            <ul style={{ listStyle: "none", margin: "20px 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {plan.features.map((f) => (
                <li key={f} style={{ fontSize: 13, color: "#cbd5e1", paddingLeft: 18, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--line)" }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleChoose(plan.id)}
              disabled={loadingPlan !== null}
              className={plan.highlight ? "btn-primary" : "btn-secondary"}
              style={{ width: "100%" }}
            >
              {loadingPlan === plan.id ? "..." : `Choisir ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ position: "relative", zIndex: 2, marginTop: 20, textAlign: "center" }}>
          <div className="error-text">{error}</div>
        </div>
      )}
    </div>
  );
}
