// ---------------------------------------------------------------------------
// Infrastructure de traduction — décidée avec Raphaël. Point de départ sur
// la page Paramètres pour valider l'approche avant de l'étendre au reste du
// site. Seuls "fr" et "en" sont remplis pour l'instant ; "ja" et "ru"
// retombent sur l'anglais en attendant leurs vraies traductions.
// ---------------------------------------------------------------------------

export type Lang = "fr" | "en" | "ja" | "ru";

export const settingsDict = {
  fr: {
    title: "Paramètres",
    appearance: "Apparence",
    wallpaper: "Fond d'écran",
    dark: "Noir",
    light: "Blanc",
    language: "Langue",
    langNote:
      "Ta préférence est enregistrée. La traduction complète de l'interface dans les 3 autres langues n'est pas encore faite — pour l'instant seul le fond d'écran change immédiatement.",
    blockedTitle: "Accès bloqué",
    blockedCanceled:
      "Ton abonnement a été résilié. Reprends un forfait pour retrouver ton dashboard, ton schéma et ton historique.",
    blockedNoPlan: "Ton compte n'a pas encore de forfait actif. Choisis un forfait pour accéder à ton dashboard.",
    viewPlans: "Voir les forfaits →",
    account: "Compte",
    email: "Email",
    newPasswordLabel: "Nouveau mot de passe",
    newPasswordHint: "(laisser vide pour ne pas changer)",
    newPasswordPlaceholder: "8 caractères minimum",
    confirmPasswordPlaceholder: "Confirme le nouveau mot de passe",
    currentPasswordLabel: "Mot de passe actuel",
    currentPasswordHint: "(requis pour confirmer)",
    currentPasswordPlaceholder: "Mot de passe actuel",
    save: "Enregistrer",
    saving: "...",
    changePlan: "Changer d'abonnement",
    changePlanSub: "Passer à un autre forfait",
    cancelPlan: "Résilier l'abonnement",
    cancelPlanSub: "Accès bloqué immédiatement jusqu'à nouveau paiement",
    cancelConfirmText:
      "Confirme la résiliation : tu perdras l'accès à l'IA, à ton schéma et à ton historique jusqu'à ce que tu repayes.",
    cancel: "Annuler",
    confirm: "Confirmer",
    confirming: "...",
    telegramTeaser: "Envie de gagner de l'argent gratuitement ? Contacte-moi.",
    telegramLink: "Nous contacter sur Telegram",
    logout: "Déconnexion",
    passwordMismatch: "Les deux mots de passe ne correspondent pas.",
    currentPasswordRequired: "Entre ton mot de passe actuel pour confirmer.",
    genericError: "Une erreur est survenue.",
    accountSaved: "Modifications enregistrées.",
  },
  en: {
    title: "Settings",
    appearance: "Appearance",
    wallpaper: "Background",
    dark: "Dark",
    light: "Light",
    language: "Language",
    langNote:
      "Your preference is saved. Full interface translation for the other 3 languages isn't done yet — for now only the background changes immediately.",
    blockedTitle: "Access blocked",
    blockedCanceled:
      "Your subscription was canceled. Pick a plan again to get back your dashboard, your schema and your history.",
    blockedNoPlan: "Your account doesn't have an active plan yet. Pick a plan to access your dashboard.",
    viewPlans: "View plans →",
    account: "Account",
    email: "Email",
    newPasswordLabel: "New password",
    newPasswordHint: "(leave empty to keep the same one)",
    newPasswordPlaceholder: "8 characters minimum",
    confirmPasswordPlaceholder: "Confirm the new password",
    currentPasswordLabel: "Current password",
    currentPasswordHint: "(required to confirm)",
    currentPasswordPlaceholder: "Current password",
    save: "Save",
    saving: "...",
    changePlan: "Change plan",
    changePlanSub: "Switch to a different plan",
    cancelPlan: "Cancel subscription",
    cancelPlanSub: "Access blocked immediately until you pay again",
    cancelConfirmText:
      "Confirm cancellation: you'll lose access to the AI, your schema and your history until you pay again.",
    cancel: "Cancel",
    confirm: "Confirm",
    confirming: "...",
    telegramTeaser: "Want to make money for free? Contact me.",
    telegramLink: "Contact us on Telegram",
    logout: "Log out",
    passwordMismatch: "The two passwords don't match.",
    currentPasswordRequired: "Enter your current password to confirm.",
    genericError: "Something went wrong.",
    accountSaved: "Changes saved.",
  },
} as const;

export function getSettingsDict(lang: Lang) {
  // "ja" et "ru" n'ont pas encore de traduction — cast nécessaire car
  // settingsDict ne contient pour l'instant que "fr" et "en", TypeScript ne
  // peut pas savoir à la compilation que le repli sur .en couvre bien tous
  // les cas manquants au runtime.
  return settingsDict[lang as keyof typeof settingsDict] ?? settingsDict.en;
}
