import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Appelée une seule fois, depuis /welcome, juste avant d'entrer dans le
// dashboard en essai gratuit (voir lib/trial.ts). Contrairement au paiement
// (checkout Stripe + PendingCheckout + webhook), ici pas besoin de détour :
// l'utilisateur est déjà connecté et l'essai est déjà actif depuis
// l'inscription, donc on enregistre directement le schéma généré avant
// inscription (mémorisé côté client en sessionStorage) — sans le régénérer,
// ce qui économise au passage un appel IA. 
const BodySchema = z.object({
  rawInput: z.string().min(1),
  schemaData: z.unknown(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  // Idempotent : si l'utilisateur a déjà un projet (ex: reload de la page,
  // ou revient sur /welcome par erreur), on ne duplique rien.
  const existing = await db.idea.findFirst({ where: { userId: user.id } });
  if (existing) {
    return NextResponse.json({ ideaId: existing.id });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    // Pas de schéma en attente (inscription directe, sans passer par
    // l'analyse gratuite) : rien à sauvegarder, l'utilisateur créera son
    // premier projet depuis /dashboard/new.
    return NextResponse.json({ ideaId: null });
  }

  const schema = parsed.data.schemaData as { projectTitle?: string };
  const idea = await db.idea.create({
    data: {
      userId: user.id,
      title: typeof schema?.projectTitle === "string" ? schema.projectTitle : "Mon projet",
      rawInput: parsed.data.rawInput,
      schemaData: JSON.stringify(parsed.data.schemaData),
    },
  });

  await db.historyEntry.create({
    data: {
      ideaId: idea.id,
      type: "creation",
      summary: "Création du projet et premier schéma généré.",
    },
  });

  return NextResponse.json({ ideaId: idea.id });
}
