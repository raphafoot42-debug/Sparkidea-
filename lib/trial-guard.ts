import crypto from "crypto";
import { db } from "./db";
import { DEVICE_COOKIE, getOrCreateDeviceId } from "./device-lock";

// ---------------------------------------------------------------------------
// Anti-abus de l'ESSAI GRATUIT : un seul essai par appareil, et un plafond par
// adresse IP, pour éviter de recréer des comptes avec d'autres emails afin
// d'obtenir 7 jours gratuits à chaque fois.
//
// Deux signaux, volontairement complémentaires :
//  1. L'appareil (cookie "spark_device", le même que celui de l'analyse
//     gratuite, voir lib/device-lock.ts) : un essai, définitivement.
//  2. L'adresse IP (stockée UNIQUEMENT sous forme de hash salé, jamais en
//     clair) : au plus TRIAL_MAX_PER_IP_PER_30_DAYS essais par IP sur 30 jours.
//     Plafond > 1 exprès : une IP partagée (école, bureau, réseau mobile)
//     ne doit pas bloquer des vrais utilisateurs différents.
//
// Rappel honnête : ce n'est pas infranchissable. Effacer ses cookies, passer
// en navigation privée ou changer de réseau (4G, VPN) contourne l'un ou
// l'autre. Ça arrête l'abus facile et répété, pas un utilisateur déterminé.
// Quand l'essai est refusé, le compte est quand même créé (sans essai) : la
// personne peut simplement choisir un forfait, on ne perd jamais une vente.
// ---------------------------------------------------------------------------
export const TRIAL_MAX_PER_IP_PER_30_DAYS = 5;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() ?? "";
}

// Hash salé avec SESSION_SECRET (déjà obligatoire pour l'authentification) :
// l'IP brute n'est jamais enregistrée en base.
export function hashIp(ip: string): string | null {
  if (!ip) return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

export function resolveDeviceId(cookieValue: string | undefined): string {
  return getOrCreateDeviceId(cookieValue).deviceId;
}

export function deviceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

export async function isTrialAllowed(deviceId: string, ipHash: string | null): Promise<boolean> {
  const deviceClaim = await db.trialClaim.findFirst({ where: { deviceHash: deviceId } });
  if (deviceClaim) return false;

  if (ipHash) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const ipClaims = await db.trialClaim.count({
      where: { ipHash, createdAt: { gte: since } },
    });
    if (ipClaims >= TRIAL_MAX_PER_IP_PER_30_DAYS) return false;
  }
  return true;
}

export async function recordTrialClaim(userId: string, deviceId: string, ipHash: string | null) {
  await db.trialClaim.create({
    data: { userId, deviceHash: deviceId, ipHash: ipHash ?? undefined },
  });
}

export { DEVICE_COOKIE };
