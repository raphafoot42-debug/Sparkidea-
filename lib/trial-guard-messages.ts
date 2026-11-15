// Texte affiché quand l'essai gratuit est refusé (voir lib/trial-guard.ts).
// Fichier séparé et sans aucun import serveur (base de données, crypto) :
// la page /pricing est un composant client et ne doit surtout pas embarquer
// lib/trial-guard.ts dans son code navigateur.
export const TRIAL_REFUSED_MESSAGE =
  "Tu as déjà utilisé un essai gratuit sur cet appareil ou ce réseau : il n'est pas possible de le recommencer avec un autre email. Choisis un forfait pour continuer.";
