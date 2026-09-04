import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";
import { resend } from "@/lib/email/resend";

const BodySchema = z.object({ email: z.string().email("Email invalide.") });

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  }

  const { email } = parsed.data;
  const user = await db.user.findUnique({ where: { email } });

  // Toujours la même réponse, que le compte existe ou non — sinon ce
  // formulaire devient un moyen de vérifier quels emails ont un compte
  // Spark Idea, ce qui est une fuite d'information classique à éviter.
  const genericResponse = NextResponse.json({
    ok: true,
    message: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.",
  });

  if (!user) return genericResponse;

  const token = await createPasswordResetToken(user.id);
  const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: "Spark Idea <onboarding@resend.dev>",
      to: user.email,
      subject: "Réinitialise ton mot de passe Spark Idea",
      html: `
        <p>Tu as demandé à réinitialiser ton mot de passe.</p>
        <p><a href="${resetUrl}">Clique ici pour choisir un nouveau mot de passe</a> (valable 1h).</p>
        <p>Si tu n'es pas à l'origine de cette demande, ignore simplement cet email — rien ne changera sur ton compte.</p>
      `,
    });
  } catch (err) {
    // On ne fait jamais échouer la requête côté utilisateur pour une panne
    // d'envoi d'email — on log seulement, pour ne pas révéler par la
    // différence de comportement si le compte existe ou non.
    console.error(`[forgot-password] Échec envoi email pour ${user.id}:`, err);
  }

  return genericResponse;
}
