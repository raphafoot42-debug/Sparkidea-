import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  askClarifyingQuestion,
  checkAnswerClarity,
  generateSchema,
  generateVerdict,
  type QaTurn,
} from "@/lib/ai/schema-generator";
import { MAX_CLARIFYING_QUESTIONS } from "@/lib/qa-constants";
import {
  DEVICE_COOKIE,
  getOrCreateDeviceId,
  isDeviceLocked,
  registerDeviceUsage,
} from "@/lib/device-lock";

const BodySchema = z.object({
  idea: z.string().min(6, "Décris un peu plus ton idée.").max(500),
  name: z.string().max(20).optional(),
  // Historique des tours déjà VALIDÉS (clairs) — vide au tout premier appel.
  qaHistory: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(MAX_CLARIFYING_QUESTIONS)
    .optional(),
  // Réponse en attente de validation pour la dernière question posée — pas
  // encore dans qaHistory tant qu'elle n'est pas jugée claire (voir
  // checkAnswerClarity). Absent au tout premier appel.
  pendingAnswer: z.object({ question: z.string(), answer: z.string() }).optional(),
});

// Étape GRATUITE : rien n'est sauvegardé en base ici. L'IA pose d'abord ses
// questions de clarification (voir askClarifyingQuestion), refuse toute
// réponse pas claire (checkAnswerClarity) pour garantir un schéma — et donc
// des quêtes — 100% propres, puis génère le schéma complet une fois qu'elle
// a assez d'infos. Le résultat final repart au client, qui le garde en
// mémoire jusqu'à l'inscription (voir /api/ideas/start-trial).
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide." },
      { status: 400 }
    );
  }

  const isFirstCall = !parsed.data.pendingAnswer && (parsed.data.qaHistory ?? []).length === 0;

  // --- Anti-abus : blocage 5 jours par appareil — vérifié uniquement au
  // tout premier appel (soumission de l'idée), pas à chaque réponse donnée
  // pendant les questions de clarification. ---
  const existingDevice = req.cookies.get(DEVICE_COOKIE)?.value;
  const { deviceId, isNew } = getOrCreateDeviceId(existingDevice);

  if (isFirstCall && !isNew) {
    try {
      const locked = await isDeviceLocked(deviceId);
      if (locked) {
        return NextResponse.json(
          {
            error:
              "Tu as déjà utilisé ton essai gratuit récemment. Réessaie dans quelques jours, ou crée un compte pour continuer.",
          },
          { status: 429 }
        );
      }
    } catch (err) {
      // Isolé de l'appel IA : si ça plante ici, c'est la connexion DB (Prisma/Postgres),
      // pas l'IA. Repérable dans les logs Vercel par ce préfixe précis.
      console.error("[api/generate] Erreur DB (isDeviceLocked) :", err);
      return NextResponse.json(
        { error: "L'analyse a échoué, réessaie dans un instant." },
        { status: 500 }
      );
    }
  }

  try {
    let qaHistory: QaTurn[] = parsed.data.qaHistory ?? [];

    // Une réponse est en attente de validation : on la juge AVANT de
    // continuer. Si elle n'est pas claire, on renvoie la même question avec
    // une explication — elle n'entre jamais dans qaHistory ni ne compte dans
    // le plafond de questions.
    if (parsed.data.pendingAnswer) {
      const clarity = await checkAnswerClarity(
        parsed.data.pendingAnswer.question,
        parsed.data.pendingAnswer.answer
      );
      if (!clarity.clear) {
        return NextResponse.json({
          type: "question",
          question: parsed.data.pendingAnswer.question,
          clarityError: clarity.reason,
        });
      }
      qaHistory = [...qaHistory, parsed.data.pendingAnswer];
    }

    // Plafond dur ATTEINT : on force la génération finale sans même
    // redemander à l'IA si elle est prête (évite un aller-retour inutile).
    const forcedDone = qaHistory.length >= MAX_CLARIFYING_QUESTIONS;
    const decision = forcedDone
      ? { done: true as const }
      : await askClarifyingQuestion(parsed.data.idea, qaHistory);

    if (!decision.done) {
      // Pas encore de schéma à ce stade — on n'enregistre pas encore l'usage
      // de l'appareil, seulement au premier appel réussi (question OU schéma).
      const response = NextResponse.json({
        type: "question",
        question: decision.question,
        qaHistory, // renvoyé pour que le client resynchronise son historique validé
      });
      if (isFirstCall) {
        await registerDeviceUsageSafely(deviceId);
        response.cookies.set(DEVICE_COOKIE, deviceId, cookieOptions());
      }
      return response;
    }

    // Prêt : on génère le schéma final en donnant à l'IA l'idée de départ
    // ENRICHIE des réponses obtenues — réutilise generateSchema() tel quel,
    // pas de duplication du prompt/format JSON.
    const enrichedInput =
      qaHistory.length === 0
        ? parsed.data.idea
        : `${parsed.data.idea}\n\nInfos complémentaires données par l'utilisateur :\n` +
          qaHistory.map((t) => `- ${t.question} → ${t.answer}`).join("\n");

    const schema = await generateSchema(enrichedInput);

    // Verdict honnête et personnalisé (voir generateVerdict) : un échec ici
    // ne doit jamais faire échouer tout le parcours, juste laisser le champ
    // vide.
    let verdict = "";
    try {
      verdict = await generateVerdict(schema, qaHistory);
    } catch (err) {
      console.error("[api/generate] Erreur génération du verdict (non bloquant) :", err);
    }

    const response = NextResponse.json({ type: "schema", schema, verdict });
    if (isFirstCall) {
      await registerDeviceUsageSafely(deviceId);
    }
    response.cookies.set(DEVICE_COOKIE, deviceId, cookieOptions());
    return response;
  } catch (err) {
    console.error("[api/generate] Erreur génération IA :", err);
    return NextResponse.json(
      { error: "L'analyse a échoué, réessaie dans un instant." },
      { status: 500 }
    );
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // un an, le blocage lui-même dure 5 jours
  };
}

async function registerDeviceUsageSafely(deviceId: string) {
  try {
    await registerDeviceUsage(deviceId);
  } catch (err) {
    // On ne bloque jamais l'utilisateur pour un échec d'écriture DB ici —
    // juste un log pour comprendre en prod.
    console.error("[api/generate] Erreur DB (registerDeviceUsage), analyse renvoyée quand même :", err);
  }
}
