// Essai gratuit après inscription, avant tout paiement : 7 jours, avec toutes
// les fonctionnalités débloquées (export PDF, suivi...), mais l'IA est
// plafonnée en nombre de messages pour garder le coût par essai très bas
// (cible : moins de 1 € par essai, voir lib/plan-limits.ts).
// Démarre à l'inscription (subscriptionStatus = "TRIAL" + trialStartedAt).
// Le vrai garde-fou de coût, c'est TRIAL_MESSAGE_LIMIT : une fois atteint,
// le chat IA est bloqué même s'il reste des jours d'essai. La durée, elle,
// ne coûte rien de plus toute seule.
// Pour ajuster : change UNIQUEMENT ces deux constantes, tout le reste de 
// l'application (bannière, quota affiché, API) les lit d'ici.
export const TRIAL_DURATION_DAYS = 7;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
export const TRIAL_MESSAGE_LIMIT = 25;

type TrialUser = {
  subscriptionStatus: string;
  trialStartedAt: Date | null;
};

export function isTrialActive(user: TrialUser): boolean {
  if (user.subscriptionStatus !== "TRIAL") return false;
  if (!user.trialStartedAt) return false;
  return Date.now() - user.trialStartedAt.getTime() < TRIAL_DURATION_MS;
}

// Accès au dashboard : abonné actif OU essai en cours (temps ET quota non
// dépassés). Point d'entrée unique — remplace les anciens checks
// `subscriptionStatus !== "ACTIVE"` un peu partout dans le code.
export function hasDashboardAccess(user: TrialUser & { trialMessagesUsed?: number }): boolean {
  if (user.subscriptionStatus === "ACTIVE") return true;
  return isTrialActive(user);
}

export function trialMsRemaining(user: Pick<TrialUser, "trialStartedAt">): number {
  if (!user.trialStartedAt) return 0;
  return Math.max(0, TRIAL_DURATION_MS - (Date.now() - user.trialStartedAt.getTime()));
}

export function trialMessagesRemaining(trialMessagesUsed: number): number {
  return Math.max(0, TRIAL_MESSAGE_LIMIT - trialMessagesUsed);
}
