// Source unique de vérité pour les 3 forfaits (19€ / 49€ / 97€).
// Tout le reste du code (API + UI) doit lire ces constantes plutôt que
// dupliquer des chiffres en dur — sinon les forfaits finissent par
// diverger entre deux endroits (c'était déjà le cas avant ce fichier —
// et encore le cas sur la page /pricing jusqu'à ce qu'on la fasse lire
// cette constante directement).
//
// Relevé le 03/09 : le coût réel en tokens Claude est de l'ordre de
// quelques centimes par message, même avec une image jointe. Les plafonds
// ci-dessous sont calés sur un budget coût-IA cible par forfait plutôt que 
// choisis au hasard : ~1,5€/mois de coût IA total pour Starter (schéma +
// quêtes + messages sur 1 idée), ~3,5€/mois pour Élite (jusqu'à 15 idées).
// Le mode essai (TRIAL_MESSAGE_LIMIT, dans lib/trial.ts) est indépendant
// de ces plafonds et n'a pas été touché.
export const QUEST_CHAT_MESSAGE_LIMITS = { STARTER: 350, PRO: 500, STUDIO: 600 } as const;
export type PlanKey = keyof typeof QUEST_CHAT_MESSAGE_LIMITS;

// Nombre maximum de projets ("idées") actifs conservés par forfait.
export const MAX_IDEAS: Record<PlanKey, number> = { STARTER: 1, PRO: 5, STUDIO: 15 };

// Suivi dans le temps (check-ins, historique, plan qui s'ajuste) : exclusif
// au forfait le plus cher, contrairement à STARTER et PRO.
export const HAS_TRACKING: Record<PlanKey, boolean> = { STARTER: false, PRO: false, STUDIO: true };

// Export PDF : disponible sur PRO et STUDIO, pas sur STARTER.
export const HAS_PDF_EXPORT: Record<PlanKey, boolean> = { STARTER: false, PRO: true, STUDIO: true };

// Repli sûr si la valeur stockée en base n'est pas une des 3 attendues
// (le champ `plan` est un String? en Prisma, pas un enum natif — voir schema.prisma).
export function toPlanKey(plan: string | null | undefined): PlanKey {
  if (plan === "PRO" || plan === "STUDIO") return plan;
  return "STARTER";
}

export function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Export PDF effectif pour un utilisateur : pendant l'essai gratuit, toutes
// les fonctionnalités "pro" sont débloquées (seule l'IA est plafonnée, voir
// lib/trial.ts) ; sinon, selon le forfait payé.
export function canExportPdf(user: { plan: string | null | undefined; subscriptionStatus: string }): boolean {
  if (user.subscriptionStatus === "TRIAL") return true;
  return HAS_PDF_EXPORT[toPlanKey(user.plan)];
}

// ---------------------------------------------------------------------------
// Prix affichés et facturation (mensuel / annuel).
// Source unique pour la page /pricing ET la page d'accueil. Les montants
// ci-dessous sont ceux AFFICHÉS : le vrai montant débité vient du Price ID
// Stripe correspondant (lib/stripe.ts) — les deux doivent rester alignés.
// Annuel = 10 mois payés sur 12 (2 mois offerts), facturé en une fois par an.
// ---------------------------------------------------------------------------
export type BillingInterval = "monthly" | "yearly";

export const PLAN_PRICES: Record<PlanKey, { monthly: number; yearly: number }> = {
  STARTER: { monthly: 19, yearly: 190 },
  PRO: { monthly: 49, yearly: 490 },
  STUDIO: { monthly: 97, yearly: 970 },
};

export function yearlySavings(plan: PlanKey): number {
  const { monthly, yearly } = PLAN_PRICES[plan];
  return monthly * 12 - yearly;
}

export function yearlyPerMonth(plan: PlanKey): number {
  return Math.round((PLAN_PRICES[plan].yearly / 12) * 100) / 100;
}

export function formatEuro(amount: number): string {
  return Number.isInteger(amount)
    ? `${amount} €`
    : `${amount.toFixed(2).replace(".", ",")} €`;
}

export const PLAN_CATALOG: Record<
  PlanKey,
  { name: string; tagline: string; features: string[]; highlight: boolean }
> = {
  STARTER: {
    name: "Starter",
    tagline: "Pour lancer et tester un projet de A à Z",
    highlight: false,
    features: [
      `${MAX_IDEAS.STARTER} idée active`,
      "Schéma complet + carte mentale interactive",
      "Quêtes guidées chaque jour",
      `${QUEST_CHAT_MESSAGE_LIMITS.STARTER} messages IA / mois`,
    ],
  },
  PRO: {
    name: "Pro",
    tagline: "Pour les créateurs sérieux ou multi-projets",
    highlight: true,
    features: [
      `Jusqu'à ${MAX_IDEAS.PRO} idées actives`,
      "Tout le forfait Starter",
      `${QUEST_CHAT_MESSAGE_LIMITS.PRO} messages IA / mois`,
      "Export PDF du dossier complet",
    ],
  },
  STUDIO: {
    name: "Élite",
    tagline: "Pour les serial-entrepreneurs et studios",
    highlight: false,
    features: [
      `Jusqu'à ${MAX_IDEAS.STUDIO} idées actives`,
      "Tout le forfait Pro",
      `${QUEST_CHAT_MESSAGE_LIMITS.STUDIO} messages IA / mois`,
      "Suivi dans le temps + historique des versions",
      "Accès prioritaire aux fonctionnalités",
    ],
  },
};
