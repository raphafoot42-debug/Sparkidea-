import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSchema } from "@/lib/ai/schema-generator";
import { MAX_IDEAS, toPlanKey } from "@/lib/plan-limits";
import { hasDashboardAccess } from "@/lib/trial";

// Contrairement à /api/generate (étape gratuite, anonyme, anti-abus par
// device), cette route sert un utilisateur DÉJÀ connecté et payant qui veut
// créer un nouveau projet directement depuis son dashboard — pas de détour
// par l'accueil ni par sessionStorage.
const BodySchema = z.object({
  idea: z.string().min(6, "Décris un peu plus ton idée.").max(500),
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
      { error: "Un forfait actif est nécessaire pour créer un projet." },
      { status: 403 }
    );
  }

  // Essai gratuit : 1 seul projet, comme le forfait Starter — pas de
  // suppression automatique de l'existant, on bloque juste la création.
  if (user.subscriptionStatus === "TRIAL") {
    const existing = await db.idea.count({ where: { userId: user.id } });
    if (existing >= 1) {
      return NextResponse.json(
        { error: "L'essai gratuit est limité à 1 projet. Passe à un forfait pour en créer d'autres." },
        { status: 403 }
      );
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  let schema;
  try {
    schema = await generateSchema(parsed.data.idea);
  } catch (err) {
    console.error("[api/ideas/create] Erreur génération IA :", err);
    return NextResponse.json(
      { error: "L'analyse a échoué, réessaie dans un instant." },
      { status: 500 }
    );
  }

  const idea = await db.idea.create({
    data: {
      userId: user.id,
      title: schema.projectTitle,
      rawInput: parsed.data.idea,
      schemaData: JSON.stringify(schema),
    },
  });

  await db.historyEntry.create({
    data: {
      ideaId: idea.id,
      type: "creation",
      summary: "Création du projet et premier schéma généré.",
    },
  });

  // Cap selon le forfait : on supprime les plus anciennes en trop, sans
  // bloquer la création du nouveau projet.
  try {
    const maxForPlan = MAX_IDEAS[toPlanKey(user.plan)];
    const allIdeas = await db.idea.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const toDelete = allIdeas.slice(maxForPlan).map((i) => i.id);
    if (toDelete.length > 0) {
      await db.idea.deleteMany({ where: { id: { in: toDelete } } });
    }
  } catch (err) {
    console.error("[api/ideas/create] Erreur nettoyage anciennes idées :", err);
  }

  return NextResponse.json({ ideaId: idea.id });
}
