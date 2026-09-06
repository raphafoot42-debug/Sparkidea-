import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Liste des conversations d'un projet — alimente le sélecteur façon
// Claude.ai dans le chat flottant (QuestChatClient).
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const ideaId = req.nextUrl.searchParams.get("ideaId");
  if (!ideaId) {
    return NextResponse.json({ error: "ideaId manquant." }, { status: 400 });
  }

  const idea = await db.idea.findFirst({ where: { id: ideaId, userId: user.id } });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const conversations = await db.conversation.findMany({
    where: { ideaId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return NextResponse.json({ conversations });
}

const CreateSchema = z.object({ ideaId: z.string() });

// Démarre une nouvelle conversation vide — le titre par défaut sera
// remplacé au premier message envoyé (voir /api/quests/chat).
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const idea = await db.idea.findFirst({ where: { id: parsed.data.ideaId, userId: user.id } });
  if (!idea) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const conversation = await db.conversation.create({
    data: { ideaId: idea.id, title: "Nouvelle conversation" },
  });

  return NextResponse.json({ conversation });
}
