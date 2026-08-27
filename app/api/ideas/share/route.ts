import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Génère un token de partage stable pour l'idée active de l'utilisateur —
// idempotent : si un token existe déjà, on le renvoie tel quel plutôt que
// d'en recréer un (sinon un ancien lien déjà partagé casserait).
export async function POST() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const idea = await db.idea.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!idea) {
    return NextResponse.json({ error: "Aucun projet à partager." }, { status: 404 });
  }

  if (idea.shareToken) {
    return NextResponse.json({ shareToken: idea.shareToken });
  }

  const shareToken = crypto.randomUUID();
  await db.idea.update({ where: { id: idea.id }, data: { shareToken } });

  return NextResponse.json({ shareToken });
}
