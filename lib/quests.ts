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
  // FIX : ne plus bloquer la génération si aucun objectif n'est défini —
  // generateQuestBatch gère déjà très bien un tableau goals vide (voir son
  // prompt). Avant, l'absence d'objectif faisait sortir la fonction ici
  // sans rien générer, silencieusement, ce qui laissait le dashboard
  // "charger" indéfiniment sans qu'aucune quête n'apparaisse jamais.

  // Les deux pistes (marketing + technique) n'ont aucune dépendance l'une
  // sur l'autre pour cette génération — on les lance en parallèle plutôt
  // qu'en série pour diviser le temps d'attente par deux.
  await Promise.all(TRACKS.map((track) => ensureTrackBatch(ideaId, schema, track, goals)));
}

async function ensureTrackBatch(ideaId: string, schema: SchemaResult, track: Track, goals: string[]) {
  const pending = await db.quest.findMany({
    where: { ideaId, track, status: "PENDING" },
  });
  if (pending.length > 0) return;

  // Deuxième filet de sécurité, indépendant du reste : quoi qu'il arrive
  // (préchargement de lien non corrigé, onglet dupliqué, futur bug qu'on
  // n'a pas encore vu), cette piste ne peut jamais relancer une génération
  // payante plus d'une fois toutes les 20 secondes. Sans ça, un seul bug
  // de prefetch suffit à vider le portefeuille en quelques minutes.
  const mostRecentAttempt = await db.quest.findFirst({
    where: { ideaId, track },
    orderBy: { createdAt: "desc" },
  });
  if (mostRecentAttempt && Date.now() - mostRecentAttempt.createdAt.getTime() < 20_000) {
    return;
  }

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

  let batch;
  try {
    batch = await generateQuestBatch(schema, track, lastStageLabel, completedTitles, goals, otherTrackCompleted);
  } catch (err) {
    // Garde-fou critique : avant, un échec ici (JSON mal formé renvoyé par
    // l'IA, erreur réseau...) repartait les mains vides — "pending" restait
    // à zéro, donc la PROCHAINE fois que cette page se chargeait (y compris
    // via un préchargement de lien, voir DrawerNav.tsx), la génération
    // repartait pour un tour, payante à chaque essai, sans jamais réussir à
    // débloquer la piste. C'est ce qui a pu ressembler à une "régénération
    // en continu" qui consomme du crédit API pour rien. Maintenant, un
    // échec insère une quête de secours immédiatement : la piste n'est
    // plus jamais "vide" après un seul essai raté, donc plus de nouvelle
    // tentative payante tant que l'utilisateur n'a pas traité cette quête.
    console.error(`[ensureTrackBatch] Échec génération IA pour la piste "${track}" (idée ${ideaId}) :`, err);
    const stillPendingAfterFailure = await db.quest.findMany({ where: { ideaId, track, status: "PENDING" } });
    if (stillPendingAfterFailure.length > 0) return;
    await db.quest.create({
      data: {
        ideaId,
        track,
        stageLabel: lastStageLabel ?? "Démarrage",
        title: "Réessayer la génération de quêtes",
        detail:
          "La génération automatique a rencontré un problème temporaire. Ouvre le chat IA du projet et écris \"relance mes quêtes\" pour réessayer manuellement.",
        order: 0,
      },
    });
    return;
  }

  // Garde-fou anti-doublon : si une autre requête concurrente (ex. deux
  // onglets ouverts, ou un préchargement Next.js) a généré un lot pendant
  // que celui-ci tournait, on ne l'insère pas une deuxième fois. On a payé
  // l'appel IA dans les deux cas si la course a eu lieu, mais au moins on
  // n'empile pas des quêtes en double dans la base.
  const stillPending = await db.quest.findMany({ where: { ideaId, track, status: "PENDING" } });
  if (stillPending.length > 0) return;

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
