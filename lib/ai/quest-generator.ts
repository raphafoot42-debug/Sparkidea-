import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { SchemaResult } from "./schema-generator";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 
// ---------------------------------------------------------------------------
// Deux pistes de quêtes, indépendantes et parallèles :
// - "technique" : construire le produit/service (MVP → lancement → croissance)
// - "marketing" : trouver des clients / de la visibilité (préparation →
//   diffusion → scale)
// Chaque piste avance par lots de 3 quêtes ("3 par jour"). Pas de fin fixe :
// une fois la piste bien avancée, l'IA continue de proposer des quêtes
// pertinentes pour ce stade (croissance continue, optimisation, etc).
// ---------------------------------------------------------------------------
export type Track = "marketing" | "technique";

const QuestBatchSchema = z.object({
  stageLabel: z.string().max(40),
  quests: z
    .array(
      z.object({
        title: z.string().max(90),
        detail: z.string().max(600),
      })
    )
    .length(3), // exactement 3 quêtes par jour
});

function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

export type QuestBatchResult = {
  stageLabel: string;
  quests: { title: string; detail: string }[];
};

// La technique de "chauffe de compte" ci-dessous est une vraie méthode
// professionnelle de croissance sur les réseaux sociaux — l'IA doit la
// connaître et l'ADAPTER quand c'est pertinent pour le projet (pas la
// recopier telle quelle à chaque fois, seulement quand créer une présence
// sociale fait sens pour CE projet précis) :
const ACCOUNT_WARMING_TECHNIQUE = `
Technique de "chauffe" de compte avant de poster (à adapter si pertinent, ne
pas imposer si le projet n'a pas besoin de réseaux sociaux) :
Jour 1 : crée le compte avec juste un email et un mot de passe. Ne poste rien,
  ne remplis pas le profil, n'ajoute aucune photo.
Jours 2-3 : laisse le compte totalement inactif, ne l'ouvre même pas.
Jours 3-4 : commence à ouvrir l'appli et à consommer du contenu de la niche
  (regarder des vidéos, liker, suivre quelques comptes), par sessions courtes
  espacées (ex: toutes les 15-30 minutes), sans jamais poster.
Jour 4-5 : complète le profil (photo, bio) puis poste un premier contenu
  simple, avec une description soignée.
L'objectif : que l'algorithme voit un compte qui se comporte comme un vrai
utilisateur avant de commencer à publier, pour un meilleur reach dès le début.
`.trim();

const TRACK_GUIDANCE: Record<Track, string> = {
  technique: `Piste TECHNIQUE : construire le produit ou service en lui-même. Progresse naturellement de "sortir un premier prototype minimal" vers "l'améliorer avec les vrais retours utilisateurs" puis "l'optimiser une fois qu'il a des utilisateurs actifs". Reste concret : quoi construire exactement, avec quels outils, dans quel ordre.`,
  marketing: `Piste MARKETING : trouver de la visibilité et des clients pour ce projet précis. Si une présence sur les réseaux sociaux est pertinente pour ce projet, tu PEUX t'appuyer sur cette technique de préparation de compte (à adapter, pas à copier mot pour mot) :\n\n${ACCOUNT_WARMING_TECHNIQUE}\n\nMais reste toujours pertinent pour LE PROJET : si un autre canal (bouche-à-oreille local, forums, groupes, prospection directe) est plus adapté, propose-le à la place. Progresse de "préparer le terrain" vers "diffuser activement" puis "optimiser ce qui convertit le mieux".`,
};

// completedTitles : titres déjà faits sur CETTE piste précise, pour ne jamais
// se répéter et voir la progression réelle.
export async function generateQuestBatch(
  schema: SchemaResult,
  track: Track,
  lastStageLabel: string | null,
  completedTitles: string[],
  goals: string[],
  otherTrackCompleted: string[] = []
): Promise<QuestBatchResult> {
  const historyBlock =
    completedTitles.length > 0
      ? `Quêtes déjà faites par l'utilisateur sur cette piste "${track}", dans l'ordre :\n${completedTitles
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}\n\nÉtape précédente : "${lastStageLabel}". Ne répète jamais une quête déjà faite. Enchaîne logiquement dessus — l'étape doit progresser, pas boucler.`
      : `Aucune quête faite pour l'instant sur cette piste : c'est la toute première série.`;

  const goalBlock = goals.length > 0
    ? `OBJECTIFS FIXÉS PAR L'UTILISATEUR (fil rouge de toutes les quêtes, marketing ET technique) :\n${goals
        .map((goal, index) => `${index + 1}. "${goal}"`)
        .join("\n")}\nChaque quête de ce lot doit faire avancer concrètement vers ces objectifs sans disperser l'utilisateur : priorise les actions les plus importantes.`
    : `L'utilisateur n'a pas encore précisé de but chiffré : reste générique mais oriente déjà vers la monétisation.`;

  const otherTrack: Track = track === "marketing" ? "technique" : "marketing";
  const otherTrackBlock =
    otherTrackCompleted.length > 0
      ? `Progression sur l'AUTRE piste ("${otherTrack}"), déjà faite :\n${otherTrackCompleted
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}`
      : `Rien de fait pour l'instant sur l'autre piste ("${otherTrack}").`;

  const productReadinessRule =
    track === "marketing"
      ? `\n7. GARDE-FOU IMPORTANT : ne propose JAMAIS une quête qui suppose que le produit/service existe déjà et est utilisable (ex: "trouve tes 5 premiers clients", "démarche des entreprises pour vendre", "récolte des avis clients") tant que la piste technique (voir ci-dessus) ne montre pas qu'une version utilisable existe. Si ce n'est pas encore le cas, oriente le marketing vers ce qui ne nécessite PAS de produit fini : valider l'idée auprès de vraies personnes, construire une audience, une liste d'attente, du contenu qui prépare le lancement. Vendre un produit qui n'existe pas encore, c'est ce qu'on veut éviter à tout prix.`
      : "";

  const system = `Tu es le moteur de quêtes du produit "Spark Idea". Les objectifs de l'utilisateur sont le fil rouge de son projet "${schema.projectTitle}". Ton rôle : le faire avancer sur la piste "${track}", une quête concrète à la fois.

PROJET : ${schema.projectTitle}
ANALYSE DÉJÀ FAITE :
${schema.nodes.map((n) => `- [${n.type}] ${n.label} : ${n.comment}`).join("\n")}

${TRACK_GUIDANCE[track]}

${goalBlock}

${otherTrackBlock}

${historyBlock}

RÈGLES STRICTES :
1. Réponds UNIQUEMENT en JSON valide, sans texte avant/après, sans balises markdown.
2. "stageLabel" : nomme l'étape actuelle en 2-4 mots (ex: "Préparation du compte", "Premiers utilisateurs", "Optimisation du prix").
3. Génère EXACTEMENT 3 quêtes (une par jour, sur 3 jours), dans l'ORDRE où l'utilisateur doit les faire.
4. Chaque quête a un "title" court (moins de 12 mots, verbe d'action) et un "detail" TRÈS concret : étapes numérotées précises, avec le nom des outils/sites/plateformes exacts à utiliser quand c'est pertinent (pas "utilise un outil de design", mais "utilise Canva, gratuit, modèle Story Instagram"), écrit à la deuxième personne ("tu"), spécifique à CE projet — jamais générique. TOUJOURS terminer le "detail" par 1-2 phrases qui expliquent POURQUOI cette quête compte (ce que ça débloque ou améliore concrètement pour le projet) — l'utilisateur doit comprendre le sens de l'étape, pas juste l'exécuter à l'aveugle.
5. Reste réaliste sur ce qu'une personne seule peut faire en une journée par quête : chaque quête doit être faisable en environ UNE HEURE de travail (pas une demi-journée). Si une étape est trop grosse pour tenir en une heure, découpe-la en plusieurs quêtes successives plutôt que d'en faire une seule trop longue — l'utilisateur a une vie à côté, l'objectif est une progression quotidienne tenable, pas un sprint épuisant.
6. Format : { "stageLabel": "...", "quests": [ { "title": "...", "detail": "..." } ] }${productReadinessRule}`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2500,
    system,
    messages: [{ role: "user", content: "Génère le prochain lot de 3 quêtes pour cette piste." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(textBlock.text));
  } catch (err) {
    console.error("[generateQuestBatch] JSON invalide. Texte brut :", textBlock.text, err);
    throw new Error("La réponse de l'IA n'est pas un JSON valide.");
  }

  const result = QuestBatchSchema.safeParse(parsed);
  if (!result.success) {
    console.error("[generateQuestBatch] Schéma Zod invalide :", JSON.stringify(result.error.flatten()));
    throw new Error("La réponse de l'IA ne respecte pas le format attendu.");
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// But final — écrit par l'utilisateur lui-même à son arrivée sur Quêtes (pas
// généré par l'IA). L'IA se contente ici de donner un avis honnête et court
// sur la faisabilité, à la deuxième personne : réaliste ? ambitieux mais
// possible ? Le but est ensuite stocké tel quel et sert de fil rouge à
// TOUTES les quêtes générées (marketing ET technique) sur ce projet.
export async function evaluateFinalGoal(schema: SchemaResult, goalText: string): Promise<string> {
  const system = `Tu donnes un avis honnête et bref (2-3 phrases MAXIMUM) sur le but qu'un utilisateur vient de fixer pour son projet, en français, à la deuxième personne ("tu"). Pas de blabla motivant creux, du concret.

PROJET : ${schema.projectTitle}
ANALYSE : ${schema.nodes.map((n) => `- [${n.type}] ${n.label} : ${n.comment}`).join("\n")}

BUT FIXÉ PAR L'UTILISATEUR : "${goalText}"

Dis-lui clairement si ce but est réaliste tel quel, ambitieux mais atteignable avec du travail régulier, ou franchement difficile dans les délais qu'il sous-entend (s'il y en a). Ne le décourage jamais complètement — même un but dur reste "possible, mais ça va demander du travail" — mais sois honnête, pas complaisant. Réponds uniquement avec le texte, sans guillemets, sans préambule.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 250,
    system,
    messages: [{ role: "user", content: "Donne ton avis sur ce but." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return "Objectif enregistré.";
  return textBlock.text.trim().replace(/^"|"$/g, "");
}

// ---------------------------------------------------------------------------
// "Prestige" : une fois qu'un projet atteint 100% (voir lib/progress.ts),
// on ne réinitialise RIEN — le schéma, l'historique et les quêtes faites
// restent. On propose juste un objectif nettement plus ambitieux, adapté à
// ce que l'utilisateur a réellement atteint (ses derniers chiffres de
// check-in), pour continuer sur LE MÊME projet.
// ---------------------------------------------------------------------------
const PrestigeSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().max(60), // ex: "Créer un système de sous-affiliation"
        pitch: z.string().max(280),
      })
    )
    .length(3),
});

export async function suggestPrestigeGoals(
  schema: SchemaResult,
  achievedGoalText: string,
  latestCheckIn: { clients: number; revenue: number; audience: number } | null
): Promise<{ title: string; pitch: string }[]> {
  const achievedBlock = latestCheckIn
    ? `Derniers chiffres déclarés : ${latestCheckIn.clients} clients, ${latestCheckIn.revenue}€ de revenu, ${latestCheckIn.audience} d'audience.`
    : `Aucun chiffre précis déclaré, mais l'utilisateur a rempli toutes ses quêtes.`;

  const system = `Tu es le moteur de "prestige" du produit "Spark Idea". Un utilisateur vient d'ATTEINDRE son objectif initial sur son projet "${schema.projectTitle}" : "${achievedGoalText}". ${achievedBlock}

Ton rôle : lui proposer EXACTEMENT 3 objectifs suivants, nettement plus ambitieux, qui exploitent ce qu'il a déjà construit pour gagner significativement plus (pas juste "continue pareil mais plus fort" — de vrais paliers différents : monétisation additionnelle, automatisation, structure qui multiplie l'effet du travail déjà fait). Adapte-toi précisément à CE projet, pas de suggestions génériques.

Réponds UNIQUEMENT en JSON strict : { "suggestions": [ { "title": "...", "pitch": "..." } ] } — "title" : 2-6 mots, verbe d'action. "pitch" : 1-2 phrases expliquant concrètement pourquoi cet objectif est le bon prochain palier pour CE projet précis.`;

  const message = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 900,
    system,
    messages: [{ role: "user", content: "Propose les 3 prochains objectifs." }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];
  try {
    const parsed = PrestigeSuggestionsSchema.parse(JSON.parse(extractJson(textBlock.text)));
    return parsed.suggestions;
  } catch (err) {
    console.error("[suggestPrestigeGoals] Réponse IA invalide :", err);
    return [];
  }
}
// est le même montant, mais compté à part (voir source="quest" dans
// UsageLog), pour ne jamais bouffer le quota de l'autre chat.
// ---------------------------------------------------------------------------
export async function answerQuestChatMessage(
  projectTitle: string,
  quest: { title: string; detail: string },
  message: string,
  image?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }
): Promise<{ reply: string }> {
  const system = `Tu aides un utilisateur bloqué sur une quête précise du projet "${projectTitle}".

QUÊTE EN COURS : ${quest.title}
DÉTAIL DÉJÀ DONNÉ : ${quest.detail}

L'utilisateur a déjà lu ce détail et ne comprend toujours pas ou ne sait pas comment s'y prendre. Aide-le concrètement, à la deuxième personne ("tu"), avec des exemples précis (noms d'outils/sites exacts si pertinent) si besoin. Si l'utilisateur a joint une capture d'écran ou une photo, regarde-la et base ta réponse dessus (ex: dis-lui exactement où cliquer, ou ce qui cloche sur l'image). Reste concentré uniquement sur CETTE quête — ne dévie pas vers d'autres sujets du projet. Réponds en 2-5 phrases maximum, pas de liste à puces sauf si vraiment nécessaire.`;

  const content: Anthropic.MessageParam["content"] = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
        { type: "text", text: message },
      ]
    : message;

  const message_ = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 600,
    system,
    messages: [{ role: "user", content }],
  });

  const textBlock = message_.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { reply: "Je n'ai pas pu répondre, réessaie." };
  }
  return { reply: textBlock.text };
}
