import { db } from "./db";
import { generateQuestBatch, type Track } from "./ai/quest-generator";
import type { SchemaResult } from "./ai/schema-generator"; 

const TRACKS: Track[] = ["marketing", "technique"];

// Garantit qu'il existe au moins une quête PENDING pour CHAQUE piste
// (marketing ET technique) de cette idée — génère un nouveau lot pour la
// piste concernée si besoin. Appelé au chargement des pages dashboard/quêtes.
// Ne fait rien tant que l'utilisateur n'a pas fixé son but final (voir
// app/dashboard/quests/page.tsx : l'écran de saisie du but passe avant).
export async function ensureQuestBatch(ideaId: string, schema: SchemaResult) {
  const idea = await db.idea.findUnique({
    where: { id: ideaId },
    select: { finalGoal: true, goals: { orderBy: { createdAt: "asc" }, select: { text: true } } },
  });
  const goals = idea?.goals.map((goal) => goal.text) ?? [];
  if (goals.length === 0 && idea?.finalGoal) {
    goals.push(idea.finalGoal);
  }
  if (goals.length === 0) return;

  for (const track of TRACKS) {
    await ensureTrackBatch(ideaId, schema, track, goals);
  }
}

async function ensureTrackBatch(ideaId: string, schema: SchemaResult, track: Track, goals: string[]) {
  const pending = await db.quest.findMany({
    where: { ideaId, track, status: "PENDING" },
  });
  if (pending.length > 0) return;

  const allOnTrack = await db.quest.findMany({
    where: { ideaId, track },
    orderBy: { createdAt: "asc" },
  });
  const lastStageLabel = allOnTrack.length > 0 ? allOnTrack[allOnTrack.length - 1].stageLabel : null;
  const completedTitles = allOnTrack.filter((q) => q.status === "DONE").map((q) => q.title);

  // Progression de l'AUTRE piste : sert à éviter par exemple des quêtes
  // marketing du type "trouve des clients" tant que la piste technique n'a
  // pas encore posé les bases d'un produit livrable — voir la règle dédiée
  // dans le prompt (quest-generator.ts).
  const otherTrack: Track = track === "marketing" ? "technique" : "marketing";
  const otherTrackDone = await db.quest.findMany({
    where: { ideaId, track: otherTrack, status: "DONE" },
    orderBy: { createdAt: "asc" },
    select: { title: true },
  });
  const otherTrackCompleted = otherTrackDone.map((q) => q.title);

  const batch = await generateQuestBatch(schema, track, lastStageLabel, completedTitles, goals, otherTrackCompleted);

  await db.quest.createMany({
    data: batch.quests.map((q, i) => ({
      ideaId,
      track,
      stageLabel: batch.stageLabel,
      title: q.title,
      detail: q.detail,
      order: i,
    })),
  });
}

// Régénère le lot suivant UNIQUEMENT sur la piste de la quête qui vient
// d'être confirmée — l'autre piste n'est pas touchée (indépendantes).
export async function ensureNextBatchForQuestTrack(questId: string) {
  const quest = await db.quest.findUnique({
    where: { id: questId },
    include: { idea: { include: { goals: { orderBy: { createdAt: "asc" } } } } },
  });
  if (!quest) return;
  const schema = JSON.parse(quest.idea.schemaData) as SchemaResult;
  const goals = quest.idea.goals.map((goal) => goal.text);
  if (goals.length === 0 && quest.idea.finalGoal) goals.push(quest.idea.finalGoal);
  if (goals.length === 0) return;
  await ensureTrackBatch(quest.ideaId, schema, quest.track as Track, goals);
}
