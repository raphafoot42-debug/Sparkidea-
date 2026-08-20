import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Compteur social honnête pour l'accueil : nombre RÉEL d'appareils distincts
// ayant lancé une analyse ce mois-ci (voir lib/device-lock.ts), pas un
// chiffre inventé. Public, en lecture seule, pas d'auth nécessaire.
export async function GET() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await db.deviceLock.count({ where: { createdAt: { gte: startOfMonth } } });

  return NextResponse.json({ count });
}
