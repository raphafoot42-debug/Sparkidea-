import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE = "spark_session";
const SESSION_DURATION_DAYS = 30;

// -----------------------------------------------------------------------
// Mots de passe : toujours hachés, jamais stockés ni affichés en clair.
// bcrypt est volontairement lent (c'est voulu, ça protège contre le
// bruteforce même si la base de données fuite un jour).
// -----------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// -----------------------------------------------------------------------
// Sessions : un token aléatoire signé, stocké en cookie httpOnly (invisible
// et inaccessible en JavaScript côté client, donc protégé contre le XSS).
// Pour rester simple ici, le token EST l'identifiant utilisateur signé avec
// SESSION_SECRET. En production, on pourrait passer à des sessions stockées
// en base pour pouvoir les révoquer individuellement (utile pour un futur
// bouton "déconnecter tous les appareils").
// -----------------------------------------------------------------------
function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET manquant dans .env");
  const hmac = crypto.createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

function unsign(signed: string): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET manquant dans .env");
  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) return null;
  const value = signed.slice(0, lastDot);
  const hmac = signed.slice(lastDot + 1);
  const expected = crypto.createHmac("sha256", secret).update(value).digest("hex");
  // Comparaison à temps constant pour éviter les attaques par timing.
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export async function createSession(userId: string) {
  const token = sign(userId);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DURATION_DAYS,
  });
}

export async function destroySession() {
  cookies().delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = unsign(token);
  if (!userId) return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

// -----------------------------------------------------------------------
// Session admin autonome — indépendante de la base de données.
// Le cookie contient la valeur "admin" signée avec SESSION_SECRET.
// Aucun compte utilisateur requis : on vérifie uniquement le code ADMIN_CODE.
// -----------------------------------------------------------------------
const ADMIN_COOKIE = "spark_admin_session";

export async function createAdminSession() {
  const token = sign("admin");
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 h
  });
}

export function verifyAdminSession(): boolean {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return unsign(token) === "admin";
}

export async function destroyAdminSession() {
  cookies().delete(ADMIN_COOKIE);
}
