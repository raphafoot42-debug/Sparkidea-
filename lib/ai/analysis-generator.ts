import Anthropic from "@anthropic-ai/sdk";
import type { SchemaResult } from "./schema-generator";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Paragraphe court généré après chaque nouveau check-in (ou au chargement de
// la page Analyse) : synthétise où en est le projet, en clair, sans jargon.
export async function generateProjectAnalysis(
  schema: SchemaResult,
  stats: {
    totalDone: number;
    marketingDone: number;
    techniqueDone: number;
    latestClients: number;
    latestRevenue: number;
    latestAudience: number;
    checkInCount: number;
  }
): Promise<string> {
  const system = `Tu es un analyste qui résume la progression d'un projet pour son fondateur, en 3-4 phrases MAXIMUM, en français, à la deuxième personne ("tu"), ton direct et concret (pas de blabla motivant creux).

PROJET : ${schema.projectTitle}

CHIFFRES ACTUELS :
- Quêtes complétées : ${stats.totalDone} (dont ${stats.marketingDone} marketing, ${stats.techniqueDone} technique)
- Dernier check-in déclaré : ${stats.latestClients} clients, ${stats.latestRevenue}€ de revenu, ${stats.latestAudience} d'audience
- Nombre de check-ins faits : ${stats.checkInCount}

Donne une lecture honnête : ce qui avance bien, ce qui traîne (ex: piste technique en avance sur marketing ou l'inverse), et si les chiffres business (clients/revenu/audience) suivent ou pas la quantité de quêtes faites. Si ${stats.checkInCount} est à 0, dis-le simplement et invite à faire un premier check-in pour avoir une vraie lecture. Pas de titre, pas de liste, juste le paragraphe.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: "Analyse la situation actuelle du projet." }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return "Analyse indisponible pour le moment.";
    return textBlock.text.trim();
  } catch (err) {
    console.error("[generateProjectAnalysis] Erreur IA :", err);
    return "Analyse indisponible pour le moment, réessaie dans un instant.";
  }
}
