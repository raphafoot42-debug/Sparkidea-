import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---------------------------------------------------------------------------
// LA GRILLE DE CRITÈRES — validée avec Raphaël. C'est le cœur du produit.
// L'IA ne "réfléchit" jamais librement : elle remplit cette grille fixe pour
// chaque idée, ce qui garantit une analyse cohérente et reproductible plutôt
// qu'un texte différent à chaque génération.
// ---------------------------------------------------------------------------
export const CRITERIA = [
  {
    key: "probleme_resolu",
    label: "Problème résolu",
    question: "À quel point la douleur est claire et fréquente chez la cible ?",
  },
  {
    key: "cible",
    label: "Cible",
    question: "La cible est-elle facile à identifier et à atteindre ?",
  },
  {
    key: "concurrence",
    label: "Concurrence",
    question: "Quelle concurrence directe ou indirecte existe déjà ?",
  },
  {
    key: "differenciation",
    label: "Différenciation possible",
    question: "Quel angle pourrait démarquer cette idée des autres ?",
  },
  {
    key: "complexite",
    label: "Complexité de réalisation",
    question: "Est-ce simple à construire seul, ou technique/lourd ?",
  },
  {
    key: "modele_revenu",
    label: "Modèle de revenu",
    question: "Le modèle de revenu est-il évident ou reste-t-il à inventer ?",
  },
] as const;

// ---------------------------------------------------------------------------
// Format de sortie forcé (JSON strict). On valide la réponse de l'IA avec Zod :
// si jamais Claude renvoie un format inattendu, on le détecte immédiatement au
// lieu de laisser une erreur silencieuse remonter jusqu'à l'utilisateur.
// ---------------------------------------------------------------------------
const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(["todo", "risk", "win"]),
  label: z.string().max(80),
  comment: z.string().max(400),
  detail: z.string().max(1200),
});

const SchemaResultSchema = z.object({
  projectTitle: z.string().max(40),
  criteria: z.record(
    z.string(),
    z.object({
      score: z.number().min(1).max(5),
      note: z.string().max(200),
    })
  ),
  overallScore: z.number().min(1).max(10),
  nodes: z.array(NodeSchema).min(3).max(8),
});

export type SchemaResult = z.infer<typeof SchemaResultSchema>;

function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

const FEW_SHOT_EXAMPLE = `
Exemple d'idée : "Une appli mobile qui aide les artisans à faire leurs devis en 2 minutes depuis le chantier."

Exemple d'analyse attendue (format et niveau de précision à reproduire) :
{
  "projectTitle": "DevisRapide",
  "criteria": {
    "probleme_resolu": { "score": 5, "note": "Douleur très fréquente et concrète : les artisans perdent un temps réel sur les devis papier ou tableur." },
    "cible": { "score": 4, "note": "Cible identifiable (artisans du bâtiment) mais dispersée, pas toujours à l'aise avec le digital." },
    "concurrence": { "score": 2, "note": "Des outils existent déjà (Obat, Facture.net) mais souvent pensés desktop, pas mobile-first." },
    "differenciation": { "score": 4, "note": "L'angle '2 minutes, sur le chantier, mobile only' peut être un vrai argument unique." },
    "complexite": { "score": 4, "note": "Faisable seul pour une V1 avec un seul type de devis, pas besoin de tout couvrir d'entrée." },
    "modele_revenu": { "score": 4, "note": "Abonnement mensuel évident, comparable aux outils de facturation déjà payés par ce public." }
  },
  "overallScore": 7.2,
  "nodes": [
    { "id": "n1", "type": "todo", "label": "Construire l'app mobile (devis en 2 min)", "comment": "Première brique : commence par un seul type de devis, pas tous les cas dès le départ.", "detail": "Étapes concrètes : 1) Choisis UN seul type de devis fréquent (ex: pose de placo) et fais uniquement celui-là en V1. 2) Utilise un framework mobile rapide (Flutter ou React Native) pour sortir un prototype en 2-3 semaines. 3) Le formulaire doit tenir en 4-5 champs max (surface, matériaux, main d'œuvre, marge) — chaque champ en trop fait fuir un artisan sur le chantier. 4) Génère un PDF propre en un clic, envoyable par SMS ou mail direct depuis l'app. 5) Teste avec 3 artisans réels avant d'ajouter le moindre autre type de devis." },
    { "id": "n2", "type": "todo", "label": "Trouver 10 premiers artisans testeurs", "comment": "Vise des groupes Facebook ou forums de métier, c'est là que ta cible discute déjà de ce problème.", "detail": "Méthodes concrètes : 1) Rejoins 5-10 groupes Facebook d'artisans (bâtiment, plomberie, électricité) et observe une semaine avant de poster. 2) Poste un message honnête : tu construis un outil pour ce problème précis, tu cherches des retours, pas des ventes. 3) Propose l'accès gratuit à vie aux 10 premiers en échange de retours réguliers. 4) Alternative : contacte directement des artisans via leur fiche Google (avis, téléphone) dans ta ville, l'approche en personne convertit mieux qu'en ligne pour ce public. 5) Un appel de 15 min avec chacun vaut plus que 50 réponses à un formulaire." },
    { "id": "n3", "type": "risk", "label": "Concurrence déjà installée", "comment": "Le risque n'est pas leur existence, c'est qu'ils sont plus complets — reste focalisé sur ta niche mobile.", "detail": "Comment gérer ce risque concrètement : 1) Ne cherche jamais à égaler leur nombre de fonctionnalités, c'est un piège qui te ralentit sans te différencier. 2) Positionne-toi explicitement sur \\"mobile, sur le chantier, en 2 minutes\\" dans toute ta communication — c'est ce qu'ils ne font pas bien. 3) Regarde leurs avis 1-2 étoiles (Trustpilot, Google) : les plaintes récurrentes sont tes opportunités de différenciation directes. 4) Si un artisan te dit \\"j'utilise déjà X\\", demande-lui ce qui l'embête avec X plutôt que d'argumenter — c'est ton meilleur insight produit." },
    { "id": "n4", "type": "risk", "label": "Devis = engagement légal, confiance à construire", "comment": "Ajoute une mention claire de conformité dès la page d'accueil pour rassurer.", "detail": "Points à traiter concrètement : 1) Ajoute une mention visible \\"devis conforme aux mentions légales obligatoires (bâtiment)\\" sur la page d'accueil et dans le PDF généré. 2) Vérifie les mentions obligatoires pour un devis dans le secteur bâtiment (durée de validité, TVA, assurance décennale) et intègre-les par défaut dans le template. 3) Précise clairement que l'app aide à générer le document mais que l'artisan reste responsable de son contenu final — évite toute ambiguïté sur qui est engagé légalement. 4) Un badge \\"vos données restent privées\\" rassure aussi, ce public est méfiant du cloud par défaut." },
    { "id": "n5", "type": "win", "label": "Définir le prix de l'abonnement", "comment": "Regarde ce que les artisans payent déjà pour un logiciel de facturation classique pour te positionner.", "detail": "Méthode concrète pour fixer le prix : 1) Recense 3-4 concurrents directs (Obat, Facture.net, Sinao) et note leur prix mensuel de base — sers-t'en comme ancrage, pas comme copie. 2) Positionne-toi légèrement en dessous au lancement (ex: 12-15€/mois) pour compenser le fait que tu es nouveau et moins complet. 3) Prévois un palier gratuit limité (ex: 3 devis/mois) pour lever la friction à l'essai, plutôt qu'un essai limité dans le temps. 4) Augmente le prix progressivement une fois que tu as des retours positifs solides (avis, bouche-à-oreille) — ne fige pas le prix trop tôt." }
  ]
}
`.trim();

function buildSystemPrompt(): string {
  const criteriaList = CRITERIA.map(
    (c) => `- "${c.key}" (${c.label}) : ${c.question}`
  ).join("\n");

  return `Tu es le moteur d'analyse du produit "Spark Idea". Un utilisateur te donne une idée de projet en une ou deux phrases. Ton rôle N'EST PAS de répondre librement : tu dois remplir une grille FIXE de 6 critères, toujours les mêmes, de façon cohérente et reproductible.

CRITÈRES À REMPLIR (exactement ces 6 clés, dans cet ordre) :
${criteriaList}

RÈGLES STRICTES :
1. Réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après, sans balises markdown (pas de \`\`\`json).
2. Chaque critère reçoit un score de 1 à 5 et une note courte (une phrase, factuelle, pas de blabla).
3. "overallScore" est TA synthèse sur 10, cohérente avec les 6 scores individuels (ne l'invente pas au hasard).
4. "nodes" contient entre 3 et 6 points concrets à afficher sur le schéma visuel de l'utilisateur : mélange de type "todo" (étapes à faire), "risk" (points de vigilance), et éventuellement "win" (opportunités). Chaque nœud a :
   - un label court (moins de 10 mots)
   - un "comment" d'1-2 phrases, écrit à la deuxième personne ("tu"), concret et actionnable — jamais générique (c'est ce qui s'affiche directement sur le schéma)
   - un "detail" plus long (3 à 5 phrases ou étapes numérotées), qui approfondit ce point précis avec des méthodes concrètes et actionnables — c'est ce qui s'affiche quand l'utilisateur clique sur "Voir plus". Toujours à la deuxième personne, jamais générique, jamais une simple reformulation du "comment".
5. "projectTitle" est un nom court et mémorable pour le projet (2-3 mots maximum), pas juste une reformulation de la phrase de l'utilisateur.
6. Reste factuel et honnête, y compris sur les points faibles — ne survends jamais une idée pour faire plaisir.

${FEW_SHOT_EXAMPLE}

Réponds maintenant pour la nouvelle idée fournie, en respectant exactement ce format.`;
}

export type QaTurn = { question: string; answer: string };

import { MAX_CLARIFYING_QUESTIONS } from "@/lib/qa-constants";
export { MAX_CLARIFYING_QUESTIONS } from "@/lib/qa-constants";

const ClarifyResultSchema = z.union([
  z.object({ done: z.literal(false), question: z.string().max(300) }),
  z.object({ done: z.literal(true) }),
]);

const ClarityResultSchema = z.union([
  z.object({ clear: z.literal(true) }),
  z.object({ clear: z.literal(false), reason: z.string().max(150) }),
]);

export async function checkAnswerClarity(
  question: string,
  answer: string
): Promise<{ clear: boolean; reason?: string }> {
  if (answer.trim().length < 3) {
    return { clear: false, reason: "Ta réponse est trop courte, développe un peu." };
  }

  const system = `Question posée au client : "${question}"
Réponse donnée : "${answer}"

Juge si cette réponse est exploitable pour construire une analyse professionnelle sérieuse : elle doit être concrète, sur le sujet de la question, et apporter une vraie information (pas "je sais pas", pas une réponse qui ignore la question, pas juste répéter la question).

Réponds UNIQUEMENT en JSON, sans texte avant/après :
- Si la réponse est exploitable, même courte : {"clear": true}
- Sinon : {"clear": false, "reason": "..."} avec une phrase courte, directe, à la deuxième personne, qui explique quoi préciser (ex: "Sois plus précis sur qui sont tes clients exactement.")

Sois raisonnable : n'exige pas un roman, juste une info réelle et sur le sujet.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 150,
    system,
    messages: [{ role: "user", content: "Juge et réponds au format demandé." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { clear: true };
  }

  try {
    const parsed = ClarityResultSchema.parse(JSON.parse(extractJson(textBlock.text)));
    return parsed.clear ? { clear: true } : { clear: false, reason: parsed.reason };
  } catch (err) {
    console.error("[checkAnswerClarity] Réponse IA invalide, on laisse passer :", textBlock.text, err);
    return { clear: true };
  }
}

export async function askClarifyingQuestion(
  ideaText: string,
  qaHistory: QaTurn[]
): Promise<{ done: boolean; question?: string }> {
  const historyText =
    qaHistory.length === 0
      ? "(aucune question posée pour l'instant)"
      : qaHistory.map((t, i) => `Q${i + 1}: ${t.question}\nR${i + 1}: ${t.answer}`).join("\n\n");

  const system = `Tu es le moteur d'analyse du produit "Spark Idea". Un utilisateur te donne une idée de projet. Avant de produire l'analyse finale (grille de 6 critères), tu dois d'abord poser des questions de clarification ciblées — jamais générer l'analyse sur une simple phrase de départ.

Idée de départ : "${ideaText}"

Historique des questions déjà posées et réponses reçues :
${historyText}

RÈGLES :
1. Si tu as déjà assez d'infos pour remplir sérieusement les 6 critères (problème résolu, cible, concurrence, différenciation, complexité, modèle de revenu), réponds : {"done": true}
2. Sinon, pose UNE SEULE question ciblée (la plus utile parmi ce qui manque), à la deuxième personne ("tu"), courte et concrète — jamais une question générique du style "parle-moi de ton projet". Privilégie les questions OUVERTES qui poussent à développer (pas de simple oui/non) : demande le "comment", le "pourquoi", ou un exemple concret plutôt qu'un choix binaire — c'est ce qui donne à l'IA la matière pour un schéma vraiment précis. Réponds : {"done": false, "question": "..."}
3. Après ${MAX_CLARIFYING_QUESTIONS} questions déjà posées, tu DOIS répondre {"done": true} même si tout n'est pas parfaitement clair — mieux vaut avancer avec ce qu'on a.
4. Réponds UNIQUEMENT en JSON valide, sans texte avant/après, sans balises markdown.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 300,
    system,
    messages: [{ role: "user", content: "Décide et réponds au format demandé." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { done: true };
  }

  try {
    const parsed = ClarifyResultSchema.parse(JSON.parse(extractJson(textBlock.text)));
    return parsed.done ? { done: true } : { done: false, question: parsed.question };
  } catch (err) {
    console.error("[askClarifyingQuestion] Réponse IA invalide, on force la génération :", textBlock.text, err);
    return { done: true };
  }
}

export async function generateVerdict(schema: SchemaResult, qaHistory: QaTurn[]): Promise<string> {
  const answersText =
    qaHistory.length === 0
      ? "(aucune réponse donnée)"
      : qaHistory.map((t) => `- ${t.question} → ${t.answer}`).join("\n");

  const criteriaText = Object.entries(schema.criteria)
    .map(([key, c]) => `- ${key} : ${c.score}/5 — ${c.note}`)
    .join("\n");

  const system = `Tu es le conseiller de Spark Idea. Voici l'analyse déjà faite du projet "${schema.projectTitle}" :

Score global : ${schema.overallScore}/10
${criteriaText}

Réponses données par l'utilisateur pendant les questions de clarification :
${answersText}

Rédige un verdict honnête et personnalisé (120 à 180 mots, texte brut, pas de JSON, pas de markdown), à la deuxième personne ("tu"), qui suit OBLIGATOIREMENT cette structure :
1. Reprend AU MOINS un détail précis donné par l'utilisateur dans ses réponses — jamais une phrase générique qui irait pour n'importe quel projet.
2. Dit clairement ce que Spark Idea peut concrètement l'aider à avancer là-dessus — SANS jamais rien promettre en termes de résultat, de gains ou de succès garanti (interdit : "tu vas réussir", "tu vas gagner X", ou toute promesse chiffrée). Reste sur du factuel : ce que l'accompagnement apporte, pas ce que ça va rapporter.
3. Si le score global ou un critère clé (concurrence, différenciation) est faible, dis-le sans détour : précise honnêtement que ce projet tel quel a un potentiel limité, qu'il ne faut pas s'attendre à aller très loin avec — ne minimise jamais ce point pour faire plaisir.
4. Termine en proposant UNE piste alternative concrète et réaliste, cohérente avec ce que l'utilisateur a révélé de lui-même (son métier, ses compétences, son contexte mentionnés dans ses réponses) — pas un pivot random, un vrai projet qui a du sens vu qui il est et ce qu'il connaît déjà. Formule ça comme une proposition ouverte ("je peux aussi t'aider à structurer..."), pas une affirmation qu'il va forcément réussir.
5. Reste factuel et direct du début à la fin, jamais dans le blabla marketing ni dans la promesse commerciale.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 500,
    system,
    messages: [{ role: "user", content: "Rédige le verdict maintenant." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return "";
  }
  return textBlock.text.trim();
}

export async function generateSchema(ideaText: string): Promise<SchemaResult> {
  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: ideaText }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide ou dans un format inattendu.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(textBlock.text));
  } catch (parseErr) {
    console.error(
      "[generateSchema] JSON.parse a échoué. Texte brut reçu de Claude :",
      textBlock.text,
      "Erreur :",
      parseErr
    );
    throw new Error("La réponse de l'IA n'est pas un JSON valide.");
  }

  const result = SchemaResultSchema.safeParse(parsed);
  if (!result.success) {
    console.error(
      "[generateSchema] Schéma Zod invalide :",
      JSON.stringify(result.error.flatten()),
      "Texte brut :",
      textBlock.text
    );
    throw new Error("La réponse de l'IA ne respecte pas le format attendu.");
  }

  return result.data;
}

export async function answerChatMessage(
  currentSchema: SchemaResult,
  userMessage: string
): Promise<{ reply: string; newNode?: z.infer<typeof NodeSchema> }> {
  const system = `Tu es l'assistant IA de Spark Idea. Tu discutes avec l'utilisateur UNIQUEMENT à propos du projet "${currentSchema.projectTitle}", dont voici l'état actuel du schéma :

${JSON.stringify(currentSchema.nodes, null, 2)}

RÈGLES :
- Si l'utilisateur semble parler d'un AUTRE projet (une idée clairement différente, pas liée au projet actuel), signale-le-lui honnêtement et demande confirmation avant de continuer — mais seulement si tu as un vrai doute. Ne demande pas systématiquement, ça deviendrait lourd.
- Le schéma ci-dessus est un premier jet généré à partir d'une simple description — il reste volontairement général. Ton rôle dans cette conversation est de le compléter : repère ce qui est encore vague ou manquant (cible précise, différenciation réelle, modèle de revenu concret...) et pose UNE question ciblée à la fois pour le préciser, plutôt que d'attendre que l'utilisateur devine quoi te dire.
- Si la demande de l'utilisateur est vague (ex: "propose-moi des idées", "aide-moi"), pose 1 à 2 questions ciblées avant de répondre, plutôt qu'une réponse générique.
- Si l'utilisateur demande d'ajouter un point au schéma, réponds en JSON avec un champ "newNode" (même format que les nœuds existants) en plus de ta réponse texte dans "reply".
- Réponds en JSON strict : { "reply": "...", "newNode": {...} } — "newNode" est optionnel, ne l'inclus que si un point doit vraiment être ajouté au schéma.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide.");
  }

  try {
    const parsed = JSON.parse(extractJson(textBlock.text));
    return {
      reply: String(parsed.reply ?? ""),
      newNode: parsed.newNode ? NodeSchema.parse(parsed.newNode) : undefined,
    };
  } catch (err) {
    console.error("[answerChatMessage] JSON invalide, fallback texte brut :", textBlock.text, err);
    return { reply: textBlock.text };
  }
}
