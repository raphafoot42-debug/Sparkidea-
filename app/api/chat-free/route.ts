import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { answerChatMessage, type SchemaResult } from "@/lib/ai/schema-generator";

const BodySchema = z.object({
  schema: z.any(),
  message: z.string().min(1).max(500),
});

// Version gratuite du chat : aucune sauvegarde, le schéma transite entier
// à chaque appel (il n'existe qu'en mémoire côté navigateur tant que le
// paiement n'est pas confirmé, comme décidé).
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const result = await answerChatMessage(
      parsed.data.schema as SchemaResult,
      parsed.data.message
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Erreur chat gratuit :", err);
    return NextResponse.json({ error: "L'IA n'a pas pu répondre." }, { status: 500 });
  }
}
