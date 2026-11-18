import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { trackAffitorSignup } from "@/lib/affitor";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  getClientIp,
  hashIp,
  isTrialAllowed,
  recordTrialClaim,
  resolveDeviceId,
} from "@/lib/trial-guard";

const BodySchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(8, "8 caractères minimum."),
  // Optionnel : peut être absent si quelqu'un s'inscrit sans être passé
  // par le tunnel "génère ton idée d'abord" (ex: lien direct vers /signup).
  firstName: z.string().trim().max(30).optional(),
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

  const { email, password, firstName } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  // Anti-abus : un seul essai gratuit par appareil (et plafond par réseau),
  // voir lib/trial-guard.ts. Si l'essai est refusé, le compte est quand même
  // créé, mais sans essai (statut "NONE") : la personne choisit un forfait.
  // Si la vérification elle-même plante (base de données), on laisse passer
  // plutôt que de bloquer une inscription légitime, et on le note dans les logs.
  const deviceId = resolveDeviceId(req.cookies.get(DEVICE_COOKIE)?.value);
  const ipHash = hashIp(getClientIp(req.headers));
  let trialAllowed = true;
  try {
    trialAllowed = await isTrialAllowed(deviceId, ipHash);
  } catch (err) {
    console.error("[api/auth/signup] Erreur vérification anti-abus essai :", err);
  }

  // L'essai gratuit (durée dans lib/trial.ts) démarre dès l'inscription, avant
  // tout paiement — pas besoin d'action supplémentaire du client.
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      firstName: firstName || undefined,
      ...(trialAllowed ? { subscriptionStatus: "TRIAL", trialStartedAt: new Date() } : {}),
    },
  });

  if (trialAllowed) {
    try {
      await recordTrialClaim(user.id, deviceId, ipHash);
    } catch (err) {
      console.error("[api/auth/signup] Erreur enregistrement de l'essai :", err);
    }
  }

  await createSession(user.id);

  // Tracking de l'inscription pour Affitor (relier l'utilisateur à l'affilié)
  const clickId = req.cookies.get("affitor_click_id")?.value;
  await trackAffitorSignup({
    customerKey: user.id,
    email: user.email,
    clickId,
  });

  const response = NextResponse.json({ ok: true, trialAvailable: trialAllowed });
  response.cookies.set(DEVICE_COOKIE, deviceId, deviceCookieOptions());
  return response;
}
