import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { answerQuestChatMessage } from "@/lib/ai/quest-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";
import { QUEST_CHAT_MESSAGE_LIMITS, startOfCurrentMonth, toPlanKey } from "@/lib/plan-limits";
import { hasDashboardAccess, TRIAL_MESSAGE_LIMIT, trialMessagesRemaining } from "@/lib/trial";

const BodySchema = z.object({
  questId: z.string(),
  message: z.string().min(1).max(500),
  image: z
    .object({
      base64: z.string().max(8_000_000), // ~6 Mo décodé, large marge pour une capture d'écran
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    })
    .optional(),
}); 

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  if (!hasDashboardAccess(user)) {
    return NextResponse.json(
      { error: "Ton essai gratuit est terminé. Choisis un forfait pour continuer à utiliser l'IA." },
      { status: 403 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const quest = await db.quest.findUnique({
    where: { id: parsed.data.questId },
    include: { idea: true },
  });
  if (!quest || quest.idea.userId !== user.id) {
    return NextResponse.json({ error: "Quête introuvable." }, { status: 404 });
  }

  // Essai gratuit : même plafond global de 15 messages que le chat schéma
  // (un seul compteur partagé sur User.trialMessagesUsed, pas deux quotas
  // séparés — voir lib/trial.ts). Sinon, quota mensuel du forfait payant.
  if (user.subscriptionStatus === "TRIAL") {
    if (trialMessagesRemaining(user.trialMessagesUsed) <= 0) {
      return NextResponse.json(
        {
          error: `Limite de ${TRIAL_MESSAGE_LIMIT} messages de l'essai gratuit atteinte. Passe à un forfait pour continuer.`,
          limitReached: true,
        },
        { status: 429 }
      );
    }
  } else {
    const planKey = toPlanKey(user.plan);
    const limit = QUEST_CHAT_MESSAGE_LIMITS[planKey];
    const startOfMonth = startOfCurrentMonth();

    const usedThisMonth = await db.usageLog.count({
      where: { userId: user.id, source: "quest", createdAt: { gte: startOfMonth } },
    });

    if (usedThisMonth >= limit) {
      return NextResponse.json(
        {
          error: `Limite de ${limit} messages atteinte ce mois-ci sur l'aide quêtes. Tes quêtes restent accessibles, la conversation reprendra le mois prochain.`,
          limitReached: true,
        },
        { status: 429 }
      );
    }
  }

  const schema = JSON.parse(quest.idea.schemaData) as SchemaResult;

  try {
    const result = await answerQuestChatMessage(
      schema.projectTitle,
      { title: quest.title, detail: quest.detail },
      parsed.data.message,
      parsed.data.image
    );
    await db.usageLog.create({ data: { userId: user.id, source: "quest" } });
    if (user.subscriptionStatus === "TRIAL") {
      await db.user.update({
        where: { id: user.id },
        data: { trialMessagesUsed: { increment: 1 } },
      });
    }
    return NextResponse.json({ reply: result.reply });
  } catch (err) {
    console.error("[api/quests/chat] Erreur IA :", err);
    return NextResponse.json({ error: "L'IA n'a pas pu répondre, réessaie." }, { status: 500 });
  }
}
