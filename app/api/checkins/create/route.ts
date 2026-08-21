import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Chiffres purement déclaratifs, pas de plancher ni de plafond : c'est un
// indicateur de motivation pour l'utilisateur, pas une donnée financière
// vérifiée. Il peut monter, descendre, remettre 0 — comme il veut.
const BodySchema = z.object({
  ideaId: z.string(),
  clients: z.number().int().min(0).max(1_000_000_000),
  revenue: z.number().min(0).max(1_000_000_000), 
  audience: z.number().int().min(0).max(1_000_000_000),
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
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const idea = await db.idea.findFirst({ where: { id: parsed.data.ideaId, userId: user.id } });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const checkIn = await db.checkIn.create({
    data: {
      ideaId: idea.id,
      clients: parsed.data.clients,
      revenue: parsed.data.revenue,
      audience: parsed.data.audience,
    },
  });

  // Trace aussi dans l'historique du projet, en texte lisible — cohérent
  // avec les autres entrées d'historique déjà affichées ailleurs.
  await db.historyEntry.create({
    data: {
      ideaId: idea.id,
      type: "checkin",
      summary: `Check-in : ${parsed.data.clients} clients, ${parsed.data.revenue}€ de revenu, ${parsed.data.audience} d'audience.`,
    },
  });

  return NextResponse.json({ ok: true, checkIn });
}
