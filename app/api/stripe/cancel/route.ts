import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function POST() {
  let user;
  try { 
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  if (!user.stripeSubscriptionId) {
    return NextResponse.json({ error: "Aucun abonnement actif." }, { status: 400 });
  }

  // Décision validée avec Raphaël : blocage IMMÉDIAT à la résiliation
  // (IA, schéma, historique inaccessibles tant qu'il n'a pas repayé) —
  // pas d'accès conservé jusqu'à la fin de la période déjà payée, contrairement
  // à ce que font la plupart des SaaS. C'est un choix assumé, pas un oubli :
  // je le signale simplement parce que c'est plus strict que l'usage courant,
  // et certains clients pourraient trouver ça étonnant de perdre l'accès
  // alors qu'ils ont déjà payé pour le mois en cours.
  await stripe.subscriptions.cancel(user.stripeSubscriptionId);

  await db.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: "CANCELED" },
  });

  return NextResponse.json({ ok: true });
}
