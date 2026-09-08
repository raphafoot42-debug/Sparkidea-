import { redirect } from "next/navigation";

// Cette page est retirée : elle faisait doublon avec l'assistant flottant
// (QuestChatClient), déjà monté sur /dashboard et /dashboard/quests, et
// surtout elle IGNORAIT le paramètre questId — cliquer "Demander à l'IA"
// depuis une quête précise ouvrait un assistant vide, sans rapport avec
// la quête concernée. Ce bouton envoie maintenant directement le prompt à
// l'assistant flottant sans navigation (voir AllQuestsClient.tsx et
// l'événement "spark:ask-ai" écouté dans QuestChatClient.tsx).
// On garde cette redirection pour ne pas casser un ancien lien/favori.
export default function AiPageRedirect({ searchParams }: { searchParams: { idea?: string } }) {
  redirect(searchParams.idea ? `/dashboard?idea=${searchParams.idea}` : "/dashboard");
}
