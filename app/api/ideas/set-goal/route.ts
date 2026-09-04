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
  // Préférence de communication pour la piste marketing — pas besoin d'un
  // champ dédié en base : stockée comme un deuxième "Goal" (pas d'appel IA
  // pour celui-ci, coût nul), lu automatiquement par generateQuestBatch
  // puisqu'il agrège déjà TOUS les Goal d'une idée dans le prompt. Ça évite
  // que l'IA marketing propose une vidéo visage à quelqu'un qui veut rester
  // anonyme, ou l'inverse.
  communicationStyle: z.enum(["visage", "anonyme", "ia_generee", "pas_decide"]).optional(),
});

const COMMUNICATION_STYLE_LABELS: Record<string, string> = {
  visage: "à l'aise pour apparaître en vidéo, montrer son visage",
  anonyme: "préfère rester anonyme — voix off, écran, texte, pas de visage",
  ia_generee: "préfère du contenu généré par IA (avatar IA, voix IA) plutôt qu'apparaître soi-même",
  pas_decide: "pas encore décidé sur son style de communication — proposer plusieurs options avant d'imposer un format",
};

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

  if (parsed.data.communicationStyle) {
    const label = COMMUNICATION_STYLE_LABELS[parsed.data.communicationStyle];
    await db.goal.upsert({
      where: { id: `${idea.id}-marketing-pref` },
      update: { text: `Préférence de communication marketing : ${label}` },
      create: {
        id: `${idea.id}-marketing-pref`,
        ideaId: idea.id,
        text: `Préférence de communication marketing : ${label}`,
      },
    });
  }

  return NextResponse.json({ ok: true, feedback });
}
