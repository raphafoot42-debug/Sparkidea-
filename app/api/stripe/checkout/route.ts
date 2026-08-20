import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { requireUser } from "@/lib/auth";
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe";
import { db } from "@/lib/db";

const BodySchema = z.object({
  plan: z.enum(["STARTER", "PRO", "STUDIO"]),
  // Optionnel : un utilisateur qui s'inscrit directement (sans passer par
  // l'analyse gratuite de l'accueil) doit pouvoir payer quand même, sans
  // idée en attente — il en créera une depuis /dashboard/new après paiement.
  pendingIdea: z
    .object({
      rawInput: z.string(),
      schemaData: z.unknown(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { plan, pendingIdea } = parsed.data;
  const priceId = PLAN_PRICE_IDS[plan];

  let stripeCustomerId = user.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email });
    stripeCustomerId = customer.id;
    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    });
  }

  // On stocke l'idée en attente à part (pas dans les metadata Stripe, trop
  // limitées en taille), et on ne transmet à Stripe qu'un token court pour
  // la retrouver depuis le webhook après paiement confirmé.
  // Si l'utilisateur n'a pas d'idée en attente (inscription directe, sans
  // passer par l'analyse gratuite), on paie quand même — pas de token, le
  // webhook ne créera simplement aucune idée, et l'utilisateur en créera une
  // depuis /dashboard/new juste après.
  let token: string | undefined;
  if (pendingIdea) {
    token = crypto.randomUUID();
    await db.pendingCheckout.create({
      data: {
        token,
        userId: user.id,
        rawInput: pendingIdea.rawInput,
        schemaData: JSON.stringify(pendingIdea.schemaData),
      },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard?payment=success`,
    cancel_url: `${baseUrl}/pricing?payment=canceled`,
    metadata: {
      userId: user.id,
      plan,
      ...(token ? { pendingCheckoutToken: token } : {}),
    },
  });

  return NextResponse.json({ url: session.url });
}
