import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

// Fait le lien entre nos trois forfaits et les Price ID Stripe (à remplir
// dans .env une fois créés dans le dashboard Stripe).
export const PLAN_PRICE_IDS = {
  STARTER: process.env.STRIPE_PRICE_STARTER!,
  PRO: process.env.STRIPE_PRICE_PRO!,
  STUDIO: process.env.STRIPE_PRICE_STUDIO!,
} as const;

export function priceIdToPlan(priceId: string): "STARTER" | "PRO" | "STUDIO" | null {
  if (priceId === PLAN_PRICE_IDS.STARTER) return "STARTER";
  if (priceId === PLAN_PRICE_IDS.PRO) return "PRO";
  if (priceId === PLAN_PRICE_IDS.STUDIO) return "STUDIO";
  return null;
}
