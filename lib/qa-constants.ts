// Constantes utilisées à la fois côté serveur (lib/ai/schema-generator.ts,
// app/api/generate) et côté client (app/page.tsx, pour afficher "Question
// X/Y"). Séparées de schema-generator.ts car ce fichier importe le SDK
// Anthropic, qui ne doit jamais être bundlé côté navigateur.
export const MAX_CLARIFYING_QUESTIONS = 8;
