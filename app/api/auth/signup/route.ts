import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

const BodySchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
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

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  // L'essai gratuit de 24h démarre dès l'inscription, avant tout paiement
  // (voir lib/trial.ts) — pas besoin d'action supplémentaire du client.
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
    },
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
