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

// Prix ANNUELS (facturés une fois par an) : à créer dans le dashboard Stripe
// (Produit existant > Ajouter un tarif > Récurrent > Annuel) puis à coller
// dans les variables d'environnement Vercel. Tant qu'une variable est vide,
// le choix "annuel" de ce forfait renvoie une erreur claire côté checkout au
// lieu de planter, et les prix mensuels continuent de fonctionner.
export const PLAN_PRICE_IDS_YEARLY = {
  STARTER: process.env.STRIPE_PRICE_STARTER_YEARLY,
  PRO: process.env.STRIPE_PRICE_PRO_YEARLY,
  STUDIO: process.env.STRIPE_PRICE_STUDIO_YEARLY,
} as const;

export function getPriceId(
  plan: "STARTER" | "PRO" | "STUDIO",
  interval: "monthly" | "yearly"
): string | undefined {
  return interval === "yearly" ? PLAN_PRICE_IDS_YEARLY[plan] : PLAN_PRICE_IDS[plan];
}

export function priceIdToPlan(priceId: string): "STARTER" | "PRO" | "STUDIO" | null {
  if (priceId === PLAN_PRICE_IDS.STARTER || priceId === PLAN_PRICE_IDS_YEARLY.STARTER) return "STARTER";
  if (priceId === PLAN_PRICE_IDS.PRO || priceId === PLAN_PRICE_IDS_YEARLY.PRO) return "PRO";
  if (priceId === PLAN_PRICE_IDS.STUDIO || priceId === PLAN_PRICE_IDS_YEARLY.STUDIO) return "STUDIO";
  return null;
}
