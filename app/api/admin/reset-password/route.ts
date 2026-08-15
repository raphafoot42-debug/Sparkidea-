import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { verifyAdminSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const BodySchema = z.object({ userId: z.string() });

export async function POST(req: NextRequest) {
  if (!verifyAdminSession()) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const target = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }

  const tempPassword = crypto.randomBytes(6).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  await db.user.update({
    where: { id: target.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true, tempPassword });
}
