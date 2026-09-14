import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SchemaResult } from "./schema-generator";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// ANALYSE STRATÉGIQUE — remplace l'ancien "paragraphe de progression" comme
// contenu principal de /dashboard/analyse (décidé avec Raphaël, suite au
// retour d'un testeur : l'ancienne page ressemblait à une fiche de suivi de
// chiffres, pas à une vraie analyse de projet).
//
// Lit le SCHÉMA en profondeur (critères + nœuds déjà générés) plutôt que de
// repartir de zéro — première étape de connexion Analyse ↔ Schéma. Règle
// stricte imposée par Raphaël : jamais de chiffre ou de donnée inventée pour
// "faire pro" — tout ce qui est une hypothèse doit être présenté comme telle.
// ---------------------------------------------------------------------------

const StrategicAnalysisSchema = z.object({
  scoreExplanation: z.string().max(500),
  marche: z.string().max(600),
  cible: z.string().max(500),
  problemeResolu: z.string().max(500),
  concurrence: z.string().max(600),
  differenciation: z.string().max(500),
  propositionDeValeur: z.string().max(400),
  monetisation: z.string().max(600),
  acquisition: z.string().max(500),
  risques: z.string().max(500),
  opportunites: z.string().max(500),
  aValider: z.array(z.string().max(150)).min(2).max(5),
  prochainesPriorites: z.array(z.string().max(150)).min(2).max(4),
});

export type StrategicAnalysis = z.infer<typeof StrategicAnalysisSchema> & { score: number };

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export async function generateStrategicAnalysis(schema: SchemaResult): Promise<StrategicAnalysis> {
  const criteriaText = Object.entries(schema.criteria)
    .map(([key, c]) => `- ${key} : ${c.score}/5 — ${c.note}`)
    .join("\n");
  const nodesText = schema.nodes.map((n) => `- [${n.type}] ${n.label} : ${n.comment}`).join("\n");

  const system = `Tu es un analyste stratégique senior qui produit une vraie analyse de projet pour son fondateur — pas une fiche générique, un document que lirait un consultant en stratégie.

PROJET : "${schema.projectTitle}"
SCORE GLOBAL DÉJÀ CALCULÉ : ${schema.overallScore}/10

CRITÈRES DÉJÀ NOTÉS (base-toi dessus, développe, ne les recopie pas tels quels) :
${criteriaText}

POINTS DÉJÀ IDENTIFIÉS DANS LE SCHÉMA (base-toi dessus aussi) :
${nodesText}

RÈGLES ABSOLUES, NON NÉGOCIABLES :
1. N'invente JAMAIS un chiffre, un prix, un nom de concurrent précis, ou une statistique de marché que tu ne peux pas justifier par le texte du projet lui-même. Si tu n'as pas l'information, dis explicitement "à valider" ou "hypothèse à tester" — ne remplis jamais un vide avec un chiffre plausible pour faire sérieux.
2. Si tu mentionnes un modèle de monétisation ou un prix, présente-le TOUJOURS comme une piste à tester, jamais comme un fait établi (ex: "un modèle par abonnement pourrait fonctionner, à valider avec de premiers clients" — pas "le prix optimal est 19€/mois").
3. Sois concret et spécifique AU PROJET — jamais une phrase qui pourrait s'appliquer à n'importe quelle idée.
4. Écris en français, à la deuxième personne ("ton projet", "tu"), ton direct de consultant, pas de blabla motivant creux.

Remplis chaque section ci-dessous. Pour "concurrence", si tu ne connais pas de concurrents réels et vérifiables pour ce projet précis, parle du TYPE de concurrence (directe/indirecte) et de la catégorie d'acteurs déjà présents, sans inventer de noms d'entreprises précis.

Réponds en JSON strict, sans texte avant/après, sans balises markdown :
{
  "scoreExplanation": "pourquoi ce score précisément — points forts ET points faibles qui l'expliquent",
  "marche": "potentiel et demande réelle pour ce projet, en te basant sur ce qui est décrit",
  "cible": "qui est vraiment la cible, à quel point elle est facile à atteindre",
  "problemeResolu": "le problème réel résolu, à quel point il est douloureux/fréquent",
  "concurrence": "concurrence directe et indirecte, catégories d'acteurs, sans inventer de noms précis si tu ne les connais pas vraiment",
  "differenciation": "l'angle de différenciation réel ou à construire",
  "propositionDeValeur": "la proposition de valeur en une ou deux phrases claires",
  "monetisation": "modèles de revenu possibles, présentés comme des pistes à tester",
  "acquisition": "canaux marketing/acquisition les plus pertinents pour CE projet précis",
  "risques": "les vrais risques, pas génériques",
  "opportunites": "les vraies opportunités concrètes",
  "aValider": ["2 à 5 hypothèses précises à tester en priorité"],
  "prochainesPriorites": ["2 à 4 priorités concrètes pour la suite, dans l'ordre"]
}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2200,
    system,
    messages: [{ role: "user", content: "Produis l'analyse stratégique complète de ce projet." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide pour l'analyse stratégique.");
  }

  const parsed = JSON.parse(extractJson(textBlock.text));
  const result = StrategicAnalysisSchema.parse(parsed);
  return { ...result, score: schema.overallScore };
}

// ---------------------------------------------------------------------------
// Paragraphe court de progression (ce qui avance / ce qui traîne) — c'est
// l'ancien contenu de generateProjectAnalysis, conservé tel quel mais
// renommé et déplacé sous l'analyse stratégique dans la page, plutôt que
// d'être LE contenu principal de la page.
// ---------------------------------------------------------------------------
export async function generateProgressSummary(
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
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: "Analyse la situation actuelle du projet." }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return "Analyse indisponible pour le moment.";
    return textBlock.text.trim();
  } catch (err) {
    console.error("[generateProgressSummary] Erreur IA :", err);
    return "Analyse indisponible pour le moment, réessaie dans un instant.";
  }
}
