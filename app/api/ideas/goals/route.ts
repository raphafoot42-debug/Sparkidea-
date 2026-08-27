import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateFinalGoal } from "@/lib/ai/quest-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    ideaId: z.string(),
    goal: z.string().trim().min(3).max(600),
  }),
  z.object({
    action: z.literal("update"),
    ideaId: z.string(),
    goalId: z.string(),
    goal: z.string().trim().min(3).max(600),
    reason: z.string().trim().min(8).max(500),
  }),
]);

async function syncLegacyGoal(idea: {
  id: string;
  finalGoal: string | null;
  finalGoalFeedback: string | null;
}) {
  const existing = await db.goal.findMany({
    where: { ideaId: idea.id },
    orderBy: { createdAt: "asc" },
  });

  if (existing.length === 0 && idea.finalGoal) {
    const legacyGoal = await db.goal.create({
      data: {
        id: `${idea.id}-initial`,
        ideaId: idea.id,
        text: idea.finalGoal,
        feedback: idea.finalGoalFeedback,
      },
    });
    return [legacyGoal];
  }

  return existing;
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Décris ton objectif et, pour une modification, explique la raison." },
      { status: 400 },
    );
  }

  const idea = await db.idea.findFirst({
    where: { id: parsed.data.ideaId, userId: user.id },
    select: {
      id: true,
      schemaData: true,
      finalGoal: true,
      finalGoalFeedback: true,
    },
  });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const goals = await syncLegacyGoal(idea);

  if (parsed.data.action === "create") {
    if (goals.length >= 3) {
      return NextResponse.json(
        { error: "Trois objectifs, c'est déjà beaucoup. Trop d'objectifs te disperseraient et te mettraient à ta perte." },
        { status: 400 },
      );
    }

    const schema = JSON.parse(idea.schemaData) as SchemaResult;
    let feedback: string | null = null;
    try {
      feedback = await evaluateFinalGoal(schema, parsed.data.goal);
    } catch (err) {
      console.error("[api/ideas/goals] Erreur IA :", err);
    }

    const goal = await db.goal.create({
      data: {
        ideaId: idea.id,
        text: parsed.data.goal,
        feedback,
      },
    });

    // Le premier objectif reste recopié dans les colonnes historiques afin
    // que les idées créées par l'ancienne version continuent de fonctionner.
    if (goals.length === 0) {
      await db.idea.update({
        where: { id: idea.id },
        data: { finalGoal: goal.text, finalGoalFeedback: feedback },
      });
    }

    await db.quest.deleteMany({ where: { ideaId: idea.id, status: "PENDING" } });
    return NextResponse.json({ ok: true, goal, feedback });
  }

  const updateData = parsed.data;
  if (updateData.action !== "update") {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }

  const goal = goals.find((item) => item.id === updateData.goalId);
  if (!goal) {
    return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
  }

  const schema = JSON.parse(idea.schemaData) as SchemaResult;
  let feedback: string | null = null;
  try {
    feedback = await evaluateFinalGoal(schema, updateData.goal);
  } catch (err) {
    console.error("[api/ideas/goals] Erreur IA :", err);
  }

  const updated = await db.goal.update({
    where: { id: goal.id },
    data: {
      text: updateData.goal,
      feedback,
      changeReason: updateData.reason,
    },
  });

  if (goals[0]?.id === goal.id) {
    await db.idea.update({
      where: { id: idea.id },
      data: { finalGoal: updated.text, finalGoalFeedback: feedback },
    });
  }

  // Les quêtes déjà terminées restent dans l'historique, mais les quêtes
  // encore à faire doivent être recalculées autour du nouvel objectif.
  await db.quest.deleteMany({ where: { ideaId: idea.id, status: "PENDING" } });

  return NextResponse.json({ ok: true, goal: updated, feedback });
}
