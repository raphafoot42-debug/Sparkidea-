// Source unique de vérité pour les 3 forfaits (9€ / 24€ / 74€).
// Tout le reste du code (API + UI) doit lire ces constantes plutôt que
// dupliquer des chiffres en dur — sinon les forfaits finissent par 
// diverger entre deux endroits (c'était déjà le cas avant ce fichier).
export const QUEST_CHAT_MESSAGE_LIMITS = { STARTER: 30, PRO: 50, STUDIO: 150 } as const;
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
