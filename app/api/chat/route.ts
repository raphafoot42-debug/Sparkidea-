import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { answerChatMessage, type SchemaResult } from "@/lib/ai/schema-generator";
import { QUEST_CHAT_MESSAGE_LIMITS, toPlanKey } from "@/lib/plan-limits";
import { hasDashboardAccess, TRIAL_MESSAGE_LIMIT, trialMessagesRemaining } from "@/lib/trial";

const BodySchema = z.object({
  ideaId: z.string(),
  message: z.string().min(1).max(500),
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

  const { ideaId, message } = parsed.data;

  // --- Isolation stricte entre projets ---
  // On ne charge QUE l'idée demandée, ET seulement si elle appartient bien
  // à l'utilisateur connecté. Impossible de toucher un autre projet, même
  // le sien, sans passer explicitement son ID — donc impossible d'en
  // modifier un autre par erreur pendant la conversation.
  const idea = await db.idea.findFirst({
    where: { id: ideaId, userId: user.id },
  });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  // --- Limite mensuelle de messages ---
  // FIX : depuis que `plan` est un String? (SQLite ne supporte pas les enums
  // natifs), il n'est plus garanti par le typage d'être "STARTER"/"PRO"/"STUDIO".
  // toPlanKey() valide explicitement, avec repli sûr sur STARTER si la valeur
  // stockée est inattendue.
  // Essai gratuit : plafond global de 15 messages sur les 24h, pas de
  // logique mensuelle (voir lib/trial.ts) — sinon, quota du forfait payant.
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
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usedThisMonth = await db.usageLog.count({
      where: { userId: user.id, source: "schema", createdAt: { gte: startOfMonth } },
    });

    if (usedThisMonth >= limit) {
      // Bloque uniquement le chat — l'utilisateur garde sa page avec le
      // schéma déjà généré, comme décidé.
      return NextResponse.json(
        {
          error: `Limite de ${limit} messages atteinte ce mois-ci. Ton schéma reste accessible, la conversation reprendra le mois prochain.`,
          limitReached: true,
        },
        { status: 429 }
      );
    }
  }

  const currentSchema = JSON.parse(idea.schemaData) as SchemaResult;

  try {
    const result = await answerChatMessage(currentSchema, message);

    await db.usageLog.create({ data: { userId: user.id, source: "schema" } });
    if (user.subscriptionStatus === "TRIAL") {
      await db.user.update({
        where: { id: user.id },
        data: { trialMessagesUsed: { increment: 1 } },
      });
    }

    // Changement de comportement volontaire : avant, un "newNode" détecté
    // par l'IA était appliqué directement au schéma, sans que l'utilisateur
    // ait rien validé. Décidé avec Raphaël : l'IA doit maintenant PROPOSER
    // le changement, pas l'appliquer elle-même — la confirmation se fait
    // côté utilisateur, via /api/chat/apply, seulement s'il clique "Appliquer".
    return NextResponse.json({ reply: result.reply, proposedNode: result.newNode ?? null });
  } catch (err) {
    console.error("Erreur chat IA :", err);
    return NextResponse.json({ error: "L'IA n'a pas pu répondre, réessaie." }, { status: 500 });
  }
}
