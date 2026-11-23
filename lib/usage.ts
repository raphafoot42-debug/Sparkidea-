import { db } from "./db";
import { startOfCurrentMonth } from "./plan-limits";

// ---------------------------------------------------------------------------
// Quota de messages IA — UN SEUL compteur par mois pour toute l'IA conversa-
// tionnelle (chat du schéma + chat des quêtes). Avant, chaque chat avait son
// propre quota (donc un client pouvait consommer le double de ce qui est
// affiché sur la page des forfaits). Maintenant, "600 messages IA par mois"
// veut dire 600 au total, tous chats confondus.
// Fichier serveur uniquement (accès base de données) : ne pas l'importer
// depuis un composant client.
// ---------------------------------------------------------------------------
export const AI_USAGE_SOURCES = ["schema", "quest"];

export function countAiMessagesThisMonth(userId: string): Promise<number> {
  return db.usageLog.count({
    where: { userId, source: { in: AI_USAGE_SOURCES }, createdAt: { gte: startOfCurrentMonth() } },
  });
}

type Reservation = { ok: true; release: () => Promise<void> } | { ok: false };

// Réserve UN message AVANT l'appel IA, de façon atomique. Pourquoi : si on se
// contentait de "compter puis répondre puis enregistrer", un script qui envoie
// 100 requêtes en parallèle passerait toutes le contrôle en même temps et
// dépasserait le quota (chaque appel IA coûte de l'argent).
//  - Essai gratuit : incrément conditionnel (jamais au-delà de trialLimit).
//  - Forfait payant : on insère la ligne PUIS on recompte ; si on dépasse la
//    limite, on retire la ligne et on refuse. Au pire quelques refus en trop
//    en cas de rafale, jamais d'acceptation en trop.
// release() annule la réservation si l'appel IA échoue (le client ne paie pas
// un message qui n'a pas répondu).
export async function reserveAiMessage(params: {
  userId: string;
  isTrial: boolean;
  source: "schema" | "quest";
  monthlyLimit: number;
  trialLimit: number;
}): Promise<Reservation> {
  const { userId, isTrial, source, monthlyLimit, trialLimit } = params;

  if (isTrial) {
    const claimed = await db.user.updateMany({
      where: { id: userId, trialMessagesUsed: { lt: trialLimit } },
      data: { trialMessagesUsed: { increment: 1 } },
    });
    if (claimed.count === 0) return { ok: false };
  }

  const usage = await db.usageLog.create({ data: { userId, source } });

  if (!isTrial) {
    const used = await countAiMessagesThisMonth(userId);
    if (used > monthlyLimit) {
      await db.usageLog.delete({ where: { id: usage.id } }).catch(() => undefined);
      return { ok: false };
    }
  }

  return {
    ok: true,
    release: async () => {
      await db.usageLog.delete({ where: { id: usage.id } }).catch(() => undefined);
      if (isTrial) {
        await db.user
          .update({ where: { id: userId }, data: { trialMessagesUsed: { decrement: 1 } } })
          .catch(() => undefined);
      }
    },
  };
}
