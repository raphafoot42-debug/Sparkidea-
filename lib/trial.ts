// Essai gratuit après inscription, avant tout paiement : 24h, plafonné en
// nombre de messages IA pour contrôler le coût en cas d'abus (spam/bot).
// Démarre à l'inscription (subscriptionStatus = "TRIAL" + trialStartedAt),
// se termine automatiquement après 24h OU après TRIAL_MESSAGE_LIMIT messages
// — le premier des deux déclenche le mur de paiement.
export const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000;
export const TRIAL_MESSAGE_LIMIT = 15;

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
