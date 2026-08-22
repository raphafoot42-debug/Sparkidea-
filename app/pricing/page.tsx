const PLANS = [
  {
    id: "STARTER" as const,
    name: "Starter",
    price: "19€",
    features: ["1 idée active", "Schéma complet + carte mentale", "30 messages IA / mois"],
    highlight: false,
  },
  {
    id: "PRO" as const,
    name: "Pro",
    price: "49€",
    features: [
      "Jusqu'à 5 idées actives",
      "Schéma complet + carte mentale",
      "Export PDF",
      "50 messages IA / mois",
    ],
    highlight: true,
  },
  {
    id: "STUDIO" as const,
    name: "Élite",
    price: "97€",
    features: [
      "Jusqu'à 15 idées actives",
      "Suivi complet dans le temps + historique",
      "Export PDF",
      "150 messages IA / mois",
    ],
    highlight: false,
  },
];
