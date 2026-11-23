"use client";

import { useState } from "react";
import {
  PLAN_CATALOG,
  PLAN_PRICES,
  formatEuro,
  maxYearlyDiscountPercent,
  yearlyPerMonth,
  yearlySavings,
  type BillingInterval,
  type PlanKey,
} from "@/lib/plan-limits";
import { TRIAL_DURATION_DAYS, TRIAL_MESSAGE_LIMIT } from "@/lib/trial";

type Props = {
  // "buy" : boutons de paiement (page /pricing).
  // "display" : affichage seul, sans bouton (page d'accueil) — décidé avec
  // Raphaël : on montre les prix et ce que contient chaque forfait, sans
  // pousser vers une autre page.
  mode: "buy" | "display";
  onChoose?: (plan: PlanKey, interval: BillingInterval) => void;
  loadingPlan?: PlanKey | null;
};

const ORDER: PlanKey[] = ["STARTER", "PRO", "STUDIO"];

// Les prix, limites et listes de fonctionnalités viennent tous de
// lib/plan-limits.ts : ce composant n'a aucun chiffre en dur, donc la page
// d'accueil et /pricing ne peuvent plus diverger l'une de l'autre.
export function PricingPlans({ mode, onChoose, loadingPlan = null }: Props) {
  const [billing, setBilling] = useState<BillingInterval>("monthly");

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        className="panel"
        style={{
          display: "inline-flex",
          padding: 4,
          borderRadius: 999,
          gap: 4,
          marginBottom: 14,
        }}
        role="group"
        aria-label="Période de facturation"
      >
        {(["monthly", "yearly"] as const).map((value) => {
          const active = billing === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setBilling(value)}
              aria-pressed={active}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 999,
                padding: "7px 16px",
                fontSize: 13,
                fontWeight: 500,
                color: active ? "#05070a" : "var(--muted)",
                background: active ? "linear-gradient(90deg, var(--line), var(--line2))" : "transparent",
              }}
            >
              {value === "monthly" ? "Mensuel" : `Annuel · jusqu'à -${maxYearlyDiscountPercent()} %`}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 30, textAlign: "center", maxWidth: 520, lineHeight: 1.6 }}>
        {TRIAL_DURATION_DAYS} jours d&apos;essai gratuit, sans carte bancaire : toutes les fonctionnalités sont
        débloquées (1 projet, {TRIAL_MESSAGE_LIMIT} messages IA pendant l&apos;essai).
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", width: "100%" }}>
        {ORDER.map((key) => {
          const plan = PLAN_CATALOG[key];
          const price = PLAN_PRICES[key];
          const yearly = billing === "yearly";
          return (
            <div
              key={key}
              className="panel"
              style={{
                width: 280,
                padding: "28px 24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
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
                    whiteSpace: "nowrap",
                  }}
                >
                  Le plus populaire
                </div>
              )}

              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, minHeight: 32, lineHeight: 1.4 }}>
                {plan.tagline}
              </div>

              <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>
                {formatEuro(yearly ? price.yearly : price.monthly)}{" "}
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}>
                  / {yearly ? "an" : "mois"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: yearly ? "var(--success)" : "var(--muted)", marginTop: 6, minHeight: 18 }}>
                {yearly
                  ? `soit ${formatEuro(yearlyPerMonth(key))} / mois · ${formatEuro(yearlySavings(key))} économisés`
                  : "Sans engagement, résiliable à tout moment"}
              </div>

              <ul
                style={{
                  listStyle: "none",
                  margin: "20px 0 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  flex: 1,
                }}
              >
                {plan.features.map((f) => (
                  <li key={f} style={{ fontSize: 13, color: "#cbd5e1", paddingLeft: 18, position: "relative", lineHeight: 1.45 }}>
                    <span style={{ position: "absolute", left: 0, color: "var(--line)" }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {mode === "buy" && onChoose && (
                <button
                  onClick={() => onChoose(key, billing)}
                  disabled={loadingPlan !== null}
                  className={plan.highlight ? "btn-primary" : "btn-secondary"}
                  style={{ width: "100%" }}
                >
                  {loadingPlan === key ? "..." : `Choisir ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
