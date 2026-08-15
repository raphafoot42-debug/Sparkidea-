import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureNextBatchForQuestTrack } from "@/lib/quests";

const BodySchema = z.object({
  questId: z.string(),
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

  // On vérifie que la quête appartient bien à une idée de l'utilisateur —
  // sinon n'importe qui pourrait confirmer la quête de quelqu'un d'autre en
  // devinant un id.
  const quest = await db.quest.findUnique({
    where: { id: parsed.data.questId },
    include: { idea: true },
  });
  if (!quest || quest.idea.userId !== user.id) {
    return NextResponse.json({ error: "Quête introuvable." }, { status: 404 });
  }
  if (quest.status === "DONE") {
    return NextResponse.json({ error: "Cette quête est déjà confirmée." }, { status: 400 });
  }

  await db.quest.update({
    where: { id: quest.id },
    data: { status: "DONE", completedAt: new Date() },
  });

  // Si c'était la dernière quête PENDING de CETTE piste, on enchaîne direct
  // sur le lot suivant de CETTE piste seulement — l'autre piste (marketing
  // ou technique) n'est pas touchée, elles avancent indépendamment.
  try {
    await ensureNextBatchForQuestTrack(quest.id);
  } catch (err) {
    // Si la génération du prochain lot échoue, on ne fait pas échouer la
    // confirmation elle-même — l'utilisateur verra juste "pas de quête pour
    // l'instant" sur cette piste et pourra recharger la page pour réessayer.
    console.error("[api/quests/complete] Erreur génération du lot suivant :", err);
  }

  return NextResponse.json({ ok: true });
}
