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
