import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { answerProjectChatMessage } from "@/lib/ai/quest-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";
import { QUEST_CHAT_MESSAGE_LIMITS, startOfCurrentMonth, toPlanKey } from "@/lib/plan-limits";
import { hasDashboardAccess, TRIAL_MESSAGE_LIMIT, trialMessagesRemaining } from "@/lib/trial";

// ideaId remplace questId — décidé avec Raphaël : le chat n'est plus limité
// à une quête sélectionnée, il connaît tout le projet et répond librement.
// conversationId est optionnel : s'il est absent, une nouvelle conversation
// est créée automatiquement (premier message d'un chat flambant neuf).
const BodySchema = z.object({
  ideaId: z.string(),
  conversationId: z.string().optional(),
  // Avant : 500 caractères max, ce qui coupait un simple paragraphe de
  // quelques phrases — ça donnait l'impression que l'IA "ne pouvait pas
  // lire" un message normal. Relevé à 8000 caractères (plusieurs
  // paragraphes), ce qui reste très raisonnable en coût vu que le
  // plafond de messages/mois limite déjà la dépense totale.
  message: z.string().min(1).max(8000),
  image: z
    .object({
      base64: z.string().max(8_000_000), // ~6 Mo décodé, large marge pour une capture d'écran
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    })
    .optional(),
});

// Titre auto-généré à partir du premier message — aucun appel IA, coût nul.
// Coupé proprement sur un mot entier plutôt qu'en plein milieu.
function titleFromMessage(message: string): string {
  const clean = message.trim().replace(/\s+/g, " ");
  if (clean.length <= 48) return clean;
  const truncated = clean.slice(0, 48);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

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

  const idea = await db.idea.findFirst({
    where: { id: parsed.data.ideaId, userId: user.id },
  });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
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
          error: `Limite de ${limit} messages atteinte ce mois-ci sur l'aide IA. Tes quêtes restent accessibles, la conversation reprendra le mois prochain.`,
          limitReached: true,
        },
        { status: 429 }
      );
    }
  }

  // Récupère la conversation existante, ou en crée une nouvelle si c'est le
  // tout premier message d'un chat flambant neuf.
  let conversation = parsed.data.conversationId
    ? await db.conversation.findFirst({ where: { id: parsed.data.conversationId, ideaId: idea.id } })
    : null;
  const isNewConversation = !conversation;
  if (!conversation) {
    conversation = await db.conversation.create({
      data: { ideaId: idea.id, title: titleFromMessage(parsed.data.message) },
    });
  }

  const schema = JSON.parse(idea.schemaData) as SchemaResult;

  const activeQuestsRaw = await db.quest.findMany({
    where: { ideaId: idea.id, status: "PENDING" },
    orderBy: { order: "asc" },
    select: { title: true, track: true },
  });
  // Prisma type le champ "track" en string brut — on le force vers le type
  // Track ("marketing" | "technique") attendu par answerProjectChatMessage.
  const activeQuests = activeQuestsRaw.map((q) => ({
    title: q.title,
    track: q.track as "marketing" | "technique",
  }));

  // Historique récent DE CETTE CONVERSATION, envoyé à l'IA pour qu'elle se
  // souvienne de ce qui vient d'être dit — plafonné à 10 messages (5
  // allers-retours) pour ne pas laisser le coût grimper sans limite sur une
  // conversation qui traîne en longueur. Récupéré AVANT d'enregistrer le
  // message actuel, pour ne pas se l'envoyer deux fois. Le contexte du
  // PROJET (schéma, quêtes), lui, reste toujours envoyé quelle que soit la
  // conversation — voir plus haut.
  const recentHistory = isNewConversation
    ? []
    : await db.chatMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { role: true, text: true },
      });
  const history = recentHistory.reverse().map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

  // On enregistre le message de l'utilisateur tout de suite — même si
  // l'appel IA échoue ensuite, on garde une trace de ce qu'il a dit (pas
  // perdu au rafraîchissement, contrairement à avant).
  await db.chatMessage.create({
    data: { conversationId: conversation.id, role: "user", text: parsed.data.message },
  });

  try {
    const result = await answerProjectChatMessage(
      schema.projectTitle,
      schema,
      activeQuests,
      parsed.data.message,
      parsed.data.image,
      history
    );
    await db.chatMessage.create({
      data: { conversationId: conversation.id, role: "assistant", text: result.reply },
    });
    // updatedAt sert à trier la liste des conversations (la plus récemment
    // active en premier, comme sur Claude.ai).
    await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    await db.usageLog.create({ data: { userId: user.id, source: "quest" } });
    if (user.subscriptionStatus === "TRIAL") {
      await db.user.update({
        where: { id: user.id },
        data: { trialMessagesUsed: { increment: 1 } },
      });
    }
    return NextResponse.json({ reply: result.reply, conversationId: conversation.id, conversationTitle: conversation.title });
  } catch (err) {
    console.error("[api/quests/chat] Erreur IA :", err);
    return NextResponse.json({ error: "L'IA n'a pas pu répondre, réessaie.", conversationId: conversation.id }, { status: 500 });
  }
}

// Historique des messages d'UNE conversation précise — appelé quand
// l'utilisateur ouvre ou change de conversation dans le chat flottant.
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId manquant." }, { status: 400 });
  }

  // Vérifie que la conversation appartient bien à un projet de cet
  // utilisateur — pas de vérification directe sur userId sur Conversation,
  // on remonte par l'idée.
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, idea: { userId: user.id } },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable." }, { status: 404 });
  }

  // Les 50 derniers messages affichés suffisent largement — pas besoin de
  // charger tout l'historique depuis le début de la conversation à chaque
  // ouverture.
  const messages = await db.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { role: true, text: true },
  });

  return NextResponse.json({ messages: messages.reverse() });
}
