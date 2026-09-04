import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumePasswordResetToken, clearPasswordResetToken, hashPassword, resetFailedLogins } from "@/lib/auth";

const BodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "8 caractères minimum."),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const user = await consumePasswordResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Ce lien est invalide ou a expiré. Refais une demande." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  // Le token ne sert qu'une fois — même si quelqu'un d'autre l'intercepte
  // après coup, il ne peut plus rien en faire. On lève aussi un éventuel
  // verrou anti-bruteforce : la personne vient de prouver qu'elle est bien
  // la propriétaire du compte via son email.
  await clearPasswordResetToken(user.id);
  await resetFailedLogins(user.id);

  return NextResponse.json({ ok: true });
}
