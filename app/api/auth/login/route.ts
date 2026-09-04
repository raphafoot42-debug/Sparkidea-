import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword, isAccountLocked, recordFailedLogin, resetFailedLogins } from "@/lib/auth";

const BodySchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  // Message volontairement générique (pas "email inconnu" vs "mot de passe faux")
  // pour ne pas révéler à un attaquant si un email existe dans la base.
  const invalidMsg = "Email ou mot de passe incorrect.";

  if (!user) {
    return NextResponse.json({ error: invalidMsg }, { status: 401 });
  }

  // Anti bruteforce : compte verrouillé après 5 échecs, 15 min. On renvoie
  // volontairement le même message "incorrect" plutôt que "compte
  // verrouillé" — sinon un attaquant apprend qu'il a trouvé le bon email
  // juste en enchaînant les essais jusqu'au verrou.
  if (isAccountLocked(user)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessaie dans quelques minutes ou réinitialise ton mot de passe." },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(user.id, user.failedLoginAttempts);
    return NextResponse.json({ error: invalidMsg }, { status: 401 });
  }

  await resetFailedLogins(user.id);
  await createSession(user.id);
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return NextResponse.json({ ok: true, isAdmin: user.isAdmin });
}
