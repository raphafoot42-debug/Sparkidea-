import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStrategicAnalysis } from "@/lib/ai/analysis-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";
import { hasDashboardAccess, TRIAL_MESSAGE_LIMIT, trialMessagesRemaining } from "@/lib/trial";

const BodySchema = z.object({ ideaId: z.string() });

// Régénération explicite de l'analyse stratégique — utile après un
// changement de schéma, ou si l'utilisateur veut une nouvelle lecture.
// Volontairement manuel (bouton), jamais automatique à chaque visite —
// voir le cache dans app/dashboard/analyse/page.tsx.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  // Avant : aucun contrôle d'accès ici, donc un compte sans forfait actif ni
  // essai valide pouvait relancer cet appel IA payant sans limite.
  if (!hasDashboardAccess(user)) {
    return NextResponse.json({ error: "Un forfait actif est nécessaire." }, { status: 403 });
  }

  // Pendant l'essai gratuit, chaque régénération compte comme un message IA
  // (même compteur partagé que le chat, voir lib/trial.ts) : sans ça, cet
  // appel de ~2200 tokens pouvait être répété sans fin et dépasser la cible
  // de coût de l'essai.
  if (user.subscriptionStatus === "TRIAL" && trialMessagesRemaining(user.trialMessagesUsed) <= 0) {
    return NextResponse.json(
      {
        error: `Limite de ${TRIAL_MESSAGE_LIMIT} messages IA de l'essai gratuit atteinte. Passe à un forfait pour continuer.`,
        limitReached: true,
      },
      { status: 429 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const idea = await db.idea.findFirst({ where: { id: parsed.data.ideaId, userId: user.id } });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const schema = JSON.parse(idea.schemaData) as SchemaResult;

  try {
    const analysis = await generateStrategicAnalysis(schema);
    await db.idea.update({ where: { id: idea.id }, data: { analysisData: JSON.stringify(analysis) } });
    if (user.subscriptionStatus === "TRIAL") {
      await db.user.update({ where: { id: user.id }, data: { trialMessagesUsed: { increment: 1 } } });
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[regenerate-analysis] Erreur IA :", err);
    return NextResponse.json({ error: "L'analyse n'a pas pu être régénérée, réessaie." }, { status: 500 });
  }
}
