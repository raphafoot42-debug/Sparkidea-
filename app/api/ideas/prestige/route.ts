import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { computeGlobalProgress } from "@/lib/progress";
import { suggestPrestigeGoals, evaluateFinalGoal } from "@/lib/ai/quest-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";

// GET : propose 3 objectifs suivants, UNIQUEMENT si le projet est déjà à 100%.
// Rien n'est réinitialisé nulle part ici — le schéma, l'historique et les
// quêtes déjà faites restent tels quels, on ajoute juste un nouveau palier. 
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const ideaId = req.nextUrl.searchParams.get("ideaId");
  if (!ideaId) return NextResponse.json({ error: "Projet manquant." }, { status: 400 });

  const idea = await db.idea.findFirst({ where: { id: ideaId, userId: user.id } });
  if (!idea) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const progress = await computeGlobalProgress(ideaId);
  if (progress < 100) {
    return NextResponse.json({ error: "Le projet n'est pas encore à 100%." }, { status: 409 });
  }

  const schema = JSON.parse(idea.schemaData) as SchemaResult;
  const latestGoal = await db.goal.findFirst({ where: { ideaId }, orderBy: { createdAt: "desc" } });
  const latestCheckIn = await db.checkIn.findFirst({ where: { ideaId }, orderBy: { createdAt: "desc" } });

  const suggestions = await suggestPrestigeGoals(
    schema,
    latestGoal?.text ?? idea.finalGoal ?? "objectif initial atteint",
    latestCheckIn ? { clients: latestCheckIn.clients, revenue: latestCheckIn.revenue, audience: latestCheckIn.audience } : null
  );

  return NextResponse.json({ suggestions });
}

const PostSchema = z.object({
  ideaId: z.string(),
  goal: z.string().min(3).max(600),
  targetMetric: z.enum(["clients", "revenue", "audience"]).optional(),
  targetValue: z.number().positive().optional(),
});

// POST : confirme l'objectif choisi (une des 3 suggestions, éventuellement
// reformulée par l'utilisateur) comme nouveau Goal actif du projet — les
// quêtes reprennent automatiquement dessus (ensureQuestBatch lit tous les
// Goal du projet, voir lib/quests.ts).
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Décris le nouvel objectif." }, { status: 400 });
  }

  const idea = await db.idea.findFirst({ where: { id: parsed.data.ideaId, userId: user.id } });
  if (!idea) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });

  const progress = await computeGlobalProgress(idea.id);
  if (progress < 100) {
    return NextResponse.json({ error: "Le projet n'est pas encore à 100%." }, { status: 409 });
  }

  const schema = JSON.parse(idea.schemaData) as SchemaResult;
  let feedback: string;
  try {
    feedback = await evaluateFinalGoal(schema, parsed.data.goal);
  } catch (err) {
    console.error("[api/ideas/prestige] Erreur IA :", err);
    feedback = "Nouvel objectif enregistré.";
  }

  const newGoal = await db.goal.create({
    data: {
      ideaId: idea.id,
      text: parsed.data.goal,
      feedback,
      targetMetric: parsed.data.targetMetric,
      targetValue: parsed.data.targetValue,
    },
  });

  return NextResponse.json({ ok: true, feedback, goalId: newGoal.id });
}
