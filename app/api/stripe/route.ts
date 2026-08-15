import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, priceIdToPlan } from "@/lib/stripe";
import { db } from "@/lib/db";
import { toPlanKey } from "@/lib/plan-limits";

// C'est ICI, et seulement ici, que les données deviennent permanentes —
// comme décidé : jamais au clic "payer" côté client (falsifiable), toujours
// via la confirmation signée de Stripe.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Signature webhook invalide :", err);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, plan, pendingCheckoutToken } = session.metadata ?? {};

      if (!userId || !plan) break;

      // FIX CRITIQUE : ne validait que "PRO" ou repli "STARTER" — tout client
      // qui venait de payer 74€ pour Élite était silencieusement enregistré
      // comme "STARTER" en base, donc plafonné à 30 messages/1 idée au lieu
      // de ce qu'il venait de payer. Utilise maintenant toPlanKey, la même
      // validation que partout ailleurs dans l'app.
      const validPlan = toPlanKey(plan);

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      await db.user.update({
        where: { id: userId },
        data: {
          plan: validPlan,
          subscriptionStatus: "ACTIVE",
          stripeSubscriptionId: subscriptionId,
        },
      });

      // Maintenant, et seulement maintenant, on sauvegarde l'idée en attente.
      if (pendingCheckoutToken) {
        const pending = await db.pendingCheckout.findUnique({
          where: { token: pendingCheckoutToken },
        });
        if (pending) {
          const idea = await db.idea.create({
            data: {
              userId: pending.userId,
              title: "Nouveau projet", // affiné ensuite depuis schemaData.projectTitle côté front
              rawInput: pending.rawInput,
              schemaData: pending.schemaData,
            },
          });
          await db.historyEntry.create({
            data: {
              ideaId: idea.id,
              type: "creation",
              summary: "Création du projet et premier schéma généré.",
            },
          });
          await db.pendingCheckout.delete({ where: { id: pending.id } });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Résiliation confirmée par Stripe → on bloque l'accès (IA, schéma,
      // historique) comme décidé, sans supprimer les données.
      const subscription = event.data.object as Stripe.Subscription;
      await db.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { subscriptionStatus: "CANCELED" },
      });
      break;
    }

    case "invoice.payment_failed": {
      // Échec de paiement (carte refusée, etc.) → même traitement que
      // résiliation, l'accès se rouvrira automatiquement au prochain paiement
      // réussi (nouvel événement checkout.session.completed ou invoice.paid).
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (subscriptionId) {
        await db.user.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { subscriptionStatus: "CANCELED" },
        });
      }
      break;
    }

    case "invoice.paid": {
      // Renouvellement mensuel réussi ou réactivation après résiliation.
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (subscriptionId) {
        await db.user.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { subscriptionStatus: "ACTIVE" },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
