// ---------------------------------------------------------------------------
// Remboursement à la résiliation d'un forfait ANNUEL (décidé avec Raphaël) :
// le client est remboursé de tout, sauf un mois de forfait.
//
// "Un mois" = un douzième de ce que le client a RÉELLEMENT payé (tarif annuel
// réduit), pas le prix du forfait mensuel : il n'a jamais payé ce prix-là.
//
// Règle appliquée (voir computeRefundCents) :
//   conservé = le plus grand entre
//              - 1 mois (REFUND_KEEP_MONTHS x montant payé / 12), et
//              - la part de l'année réellement utilisée (au prorata du temps),
//   remboursé = montant payé - conservé.
// Pourquoi le "plus grand des deux" : si un client résiliait au 11e mois, lui
// rembourser tout sauf un mois reviendrait à rendre de l'argent pour du temps
// déjà consommé. En cas de résiliation rapide (cas visé), on garde bien
// exactement un mois.
//
// Exemples (Pro, 359,88 € payés pour 12 mois, soit 29,99 € par mois) :
//   résiliation au 3e jour  -> conservé 29,99 €,  remboursé 329,89 €
//   résiliation au 6e mois  -> conservé ~179,9 €, remboursé ~180 €
// Les mensuels ne sont pas remboursés (un mois payé = un mois conservé).
//
// Pour changer la règle : modifier REFUND_KEEP_MONTHS ou cette fonction.
// ---------------------------------------------------------------------------
export const REFUND_KEEP_MONTHS = 1;

export function computeRefundCents(params: {
  paidCents: number;
  periodStartMs: number;
  periodEndMs: number;
  nowMs: number;
}): number {
  const { paidCents, periodStartMs, periodEndMs, nowMs } = params;
  if (paidCents <= 0 || periodEndMs <= periodStartMs) return 0;

  const oneMonthCents = Math.round(paidCents / 12);
  const elapsed = Math.min(1, Math.max(0, (nowMs - periodStartMs) / (periodEndMs - periodStartMs)));
  const usedCents = Math.ceil(paidCents * elapsed);
  const keepCents = Math.max(oneMonthCents * REFUND_KEEP_MONTHS, usedCents);

  return Math.max(0, Math.floor(paidCents - keepCents));
}
