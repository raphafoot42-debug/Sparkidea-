import { db } from "./db";

// Barre de progression globale d'un projet (écran Historique), sur 0-100%.
//
// Volontairement PAS un simple ratio "quêtes cochées". Un client qui
// confirme toutes ses quêtes sans jamais déclarer de résultat réel ne doit
// jamais atteindre 100% — sinon la barre ne veut plus rien dire.
//
// Répartition :
//   - Effort (quêtes confirmées, toutes pistes confondues) : plafonné à 40%.
//   - Résultat réel (dernier check-in vs l'objectif chiffré fixé)  : 60%.
// Sans objectif chiffré (targetMetric/targetValue), le résultat réel est
// impossible à évaluer : la barre reste plafonnée à la part effort (40%
// max) tant que l'utilisateur n'a pas fixé de cible chiffrée.
export async function computeGlobalProgress(ideaId: string): Promise<number> {
  const [doneQuestsCount, totalQuestsCount, latestGoal, latestCheckIn] = await Promise.all([
    db.quest.count({ where: { ideaId, status: "DONE" } }),
    db.quest.count({ where: { ideaId } }),
    db.goal.findFirst({
      where: { ideaId, targetMetric: { not: null }, targetValue: { not: null } },
      orderBy: { createdAt: "desc" },
    }),
    db.checkIn.findFirst({ where: { ideaId }, orderBy: { createdAt: "desc" } }),
  ]);

  const effortRatio = totalQuestsCount > 0 ? doneQuestsCount / totalQuestsCount : 0;
  const effortScore = Math.min(40, effortRatio * 40);

  if (!latestGoal || !latestGoal.targetMetric || !latestGoal.targetValue || latestGoal.targetValue <= 0) {
    return Math.round(effortScore);
  }

  const currentValue = latestCheckIn
    ? latestGoal.targetMetric === "clients"
      ? latestCheckIn.clients
      : latestGoal.targetMetric === "revenue"
        ? latestCheckIn.revenue
        : latestCheckIn.audience
    : 0;

  const resultRatio = Math.min(1, Math.max(0, currentValue / latestGoal.targetValue));
  const resultScore = resultRatio * 60;

  return Math.round(Math.min(100, effortScore + resultScore));
}

// Progression technique seule (écran Quêtes/Analyse) — un simple ratio de
// complétion sur la piste "technique", volontairement plus simple que la
// barre globale : ici on mesure juste l'effort d'affinage technique, pas
// un résultat business.
export async function computeTechnicalProgress(ideaId: string): Promise<number> {
  const [done, total] = await Promise.all([
    db.quest.count({ where: { ideaId, track: "technique", status: "DONE" } }),
    db.quest.count({ where: { ideaId, track: "technique" } }),
  ]);
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}
