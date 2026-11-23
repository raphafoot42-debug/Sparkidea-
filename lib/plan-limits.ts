// Source unique de vérité pour les 3 forfaits (19€ / 49€ / 97€).
// Tout le reste du code (API + UI) doit lire ces constantes plutôt que
// dupliquer des chiffres en dur — sinon les forfaits finissent par
// diverger entre deux endroits (c'était déjà le cas avant ce fichier —
// et encore le cas sur la page /pricing jusqu'à ce qu'on la fasse lire
// cette constante directement).
//
// Messages IA par mois, TOUS CHATS CONFONDUS (chat du schéma + chat des
// quêtes : un seul compteur, voir lib/usage.ts). Décidé avec Raphaël : 600 /
// 1000 / 2000, pour que l'utilisateur puisse parler à son IA quand il veut.
//
// Coût estimé (modèle claude-sonnet-4-6) : environ 1 à 1,5 centime par
// message (contexte projet ~600 tokens + historique de 10 messages maximum +
// réponse plafonnée à 700 tokens). Budget IA maximum par mois SI TOUS les
// messages sont utilisés : Starter ~9 €, Pro ~15 €, Élite ~30 €. L'usage
// réel est en général bien en dessous (30 à 40 % du plafond). Marge la plus
// serrée : Starter annuel (12,99 €/mois) à 100 % d'utilisation. À surveiller
// avec la consommation réelle (console Anthropic) avant de relever encore.
// Le mode essai (TRIAL_MESSAGE_LIMIT, dans lib/trial.ts) est indépendant.
export const QUEST_CHAT_MESSAGE_LIMITS = { STARTER: 600, PRO: 1000, STUDIO: 2000 } as const;
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
// Annuel = facturé en une seule fois par an, à un tarif réduit (prix réels
// créés dans Stripe : 12,99 / 29,99 / 69,99 € par mois, soit 155,88 / 359,88 /
// 839,88 € par an).
// ---------------------------------------------------------------------------
export type BillingInterval = "monthly" | "yearly";

export const PLAN_PRICES: Record<PlanKey, { monthly: number; yearly: number }> = {
  STARTER: { monthly: 19, yearly: 155.88 },
  PRO: { monthly: 49, yearly: 359.88 },
  STUDIO: { monthly: 97, yearly: 839.88 },
};

// Plus forte réduction annuelle parmi les forfaits, en % (pour l'étiquette du
// bouton "Annuel"). Calculée à partir des prix ci-dessus : si tu changes un
// prix, l'étiquette suit toute seule.
export function maxYearlyDiscountPercent(): number {
  return Math.round(
    Math.max(
      ...(Object.keys(PLAN_PRICES) as PlanKey[]).map((key) => {
        const { monthly, yearly } = PLAN_PRICES[key];
        return (1 - yearly / (monthly * 12)) * 100;
      })
    )
  );
}

export function yearlySavings(plan: PlanKey): number {
  const { monthly, yearly } = PLAN_PRICES[plan];
  return Math.round((monthly * 12 - yearly) * 100) / 100;
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
      `${QUEST_CHAT_MESSAGE_LIMITS.STARTER} messages avec ton IA personnelle par mois`,
    ],
  },
  PRO: {
    name: "Pro",
    tagline: "Pour les créateurs sérieux ou multi-projets",
    highlight: true,
    features: [
      `Jusqu'à ${MAX_IDEAS.PRO} idées actives`,
      "Tout le forfait Starter",
      `${QUEST_CHAT_MESSAGE_LIMITS.PRO} messages avec ton IA personnelle par mois`,
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
      `${QUEST_CHAT_MESSAGE_LIMITS.STUDIO} messages avec ton IA personnelle par mois`,
      "Suivi dans le temps + historique des versions",
      "Accès prioritaire aux fonctionnalités",
    ],
  },
};
