const MOTIVATIONS = [
  "Chaque petit pas compte. Aujourd'hui, avance juste d'un cran.",
  "Ton projet ne se construira pas tout seul, mais tu n'es pas seul pour le construire.",
  "Les idées ne valent rien sans exécution. Passe à l'action aujourd'hui.",
  "Un jour sans avancer, c'est un jour de retard sur ton objectif.",
  "Le meilleur moment pour avancer, c'était hier. Le deuxième meilleur, c'est maintenant.",
  "Ton futur toi te remerciera pour ce que tu fais aujourd'hui.",
  "La régularité bat le talent. Continue.",
];

function pickMotivation(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return MOTIVATIONS[hash % MOTIVATIONS.length];
}

export type DigestQuest = {
  title: string;
  track: string; // "marketing" | "technique"
};

export function buildDailyDigestEmail(params: {
  userId: string;
  ideaTitle: string | null;
  quests: DigestQuest[];
}): { subject: string; html: string } {
  const { userId, ideaTitle, quests } = params;
  const dateKey = new Date().toISOString().slice(0, 10);
  const motivation = pickMotivation(userId + dateKey);

  const questsHtml = quests.length
    ? quests
        .map(
          (q) =>
            `<li style="margin-bottom:8px;"><strong>${q.track === "marketing" ? "Marketing" : "Technique"}</strong> — ${q.title}</li>`
        )
        .join("")
    : `<li>T'inquiète, tes prochaines quêtes t'attendent déjà — ouvre ton dashboard, elles sont prêtes.</li>`;

  const subject = ideaTitle
    ? `Aujourd'hui, fais avancer ${ideaTitle}`
    : "Ton point du jour sur Spark Idea";

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <p style="font-size: 14px; color: #555;">${motivation}</p>
      <h2 style="font-size: 18px; margin-top: 20px;">Aujourd'hui, tu peux avancer sur :</h2>
      <ul style="font-size: 14px; padding-left: 18px;">${questsHtml}</ul>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard"
         style="display:inline-block; margin-top: 20px; padding: 10px 18px; background:#111; color:#fff; text-decoration:none; border-radius: 6px; font-size: 14px;">
        Voir mon dashboard
      </a>
    </div>
  `;

  return { subject, html };
}
