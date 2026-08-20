import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateFinalGoal } from "@/lib/ai/quest-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";

const BodySchema = z.object({
  ideaId: z.string(),
  goal: z.string().min(3).max(600),
  targetMetric: z.enum(["clients", "revenue", "audience"]).optional(),
  targetValue: z.number().positive().optional(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Décris ton but en quelques mots." }, { status: 400 });
  }

  const idea = await db.idea.findFirst({ where: { id: parsed.data.ideaId, userId: user.id } });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const schema = JSON.parse(idea.schemaData) as SchemaResult;

  let feedback: string;
  try {
    feedback = await evaluateFinalGoal(schema, parsed.data.goal);
  } catch (err) {
    console.error("[api/ideas/set-goal] Erreur IA :", err);
    feedback = "But enregistré — l'avis de l'IA n'a pas pu être généré, réessaie plus tard depuis Quêtes.";
  }

  await db.idea.update({
    where: { id: idea.id },
    data: { finalGoal: parsed.data.goal, finalGoalFeedback: feedback },
  });

  await db.goal.upsert({
    where: { id: `${idea.id}-initial` },
    update: {
      text: parsed.data.goal,
      feedback,
      targetMetric: parsed.data.targetMetric,
      targetValue: parsed.data.targetValue,
    },
    create: {
      id: `${idea.id}-initial`,
      ideaId: idea.id,
      text: parsed.data.goal,
      feedback,
      targetMetric: parsed.data.targetMetric,
      targetValue: parsed.data.targetValue,
    },
  });

  return NextResponse.json({ ok: true, feedback });
}
