import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { computeRefundCents } from "@/lib/refund";

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
  const subscriptionId = user.stripeSubscriptionId;

  // 1) On lit l'abonnement AVANT de l'annuler, pour savoir s'il est annuel et
  //    combien rembourser (règle : tout sauf un mois, voir lib/refund.ts).
  //    Si on n'arrive pas à le lire, on n'annule rien : mieux vaut un échec
  //    clair qu'une résiliation sans remboursement qu'on ne pourrait pas
  //    rattraper proprement.
  let refund: { chargeId: string; cents: number; invoiceId: string } | null = null;
  let alreadyCanceled = false;
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
    alreadyCanceled = sub.status === "canceled";

    const isYearly = sub.items.data[0]?.price?.recurring?.interval === "year";
    const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const chargeId = invoice ? (typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id) : null;

    if (!alreadyCanceled && isYearly && invoice && chargeId && invoice.amount_paid > 0) {
      const wantedCents = computeRefundCents({
        paidCents: invoice.amount_paid,
        periodStartMs: sub.current_period_start * 1000,
        periodEndMs: sub.current_period_end * 1000,
        nowMs: Date.now(),
      });

      // On ne rembourse jamais plus que ce qui reste remboursable sur ce
      // paiement (évite une erreur Stripe si un remboursement a déjà eu lieu).
      const charge = await stripe.charges.retrieve(chargeId);
      const refundableCents = charge.amount - charge.amount_refunded;
      const cents = Math.min(wantedCents, refundableCents);
      if (cents > 0) refund = { chargeId, cents, invoiceId: invoice.id };
    }
  } catch (err) {
    console.error("[stripe/cancel] Impossible de lire l'abonnement, résiliation annulée :", err);
    return NextResponse.json(
      { error: "Impossible de traiter la résiliation pour le moment, réessaie dans un instant." },
      { status: 502 }
    );
  }

  // 2) Résiliation immédiate, sans facture de régularisation automatique :
  //    le remboursement est géré par nous, à l'étape 3.
  //    Décision validée avec Raphaël : blocage IMMÉDIAT de l'accès.
  if (!alreadyCanceled) {
    await stripe.subscriptions.cancel(subscriptionId, { prorate: false, invoice_now: false });
  }

  await db.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: "CANCELED" },
  });

  // 3) Remboursement. La clé d'idempotence garantit qu'un double clic ou une
  //    nouvelle tentative ne rembourse jamais deux fois la même facture.
  //    Si le remboursement échoue, l'abonnement est déjà annulé : on le
  //    signale clairement (logs + réponse) pour le traiter à la main dans
  //    le dashboard Stripe.
  let refundedCents = 0;
  let refundFailed = false;
  if (refund) {
    try {
      await stripe.refunds.create(
        {
          charge: refund.chargeId,
          amount: refund.cents,
          reason: "requested_by_customer",
          metadata: { userId: user.id, subscriptionId, invoiceId: refund.invoiceId },
        },
        { idempotencyKey: `cancel-refund-${subscriptionId}-${refund.invoiceId}` }
      );
      refundedCents = refund.cents;
    } catch (err) {
      refundFailed = true;
      console.error(
        `[stripe/cancel] REMBOURSEMENT ÉCHOUÉ — à faire à la main : ${refund.cents / 100} € sur la charge ${refund.chargeId} (utilisateur ${user.id}) :`,
        err
      );
    }
  }

  return NextResponse.json({ ok: true, refundedCents, refundFailed });
}
