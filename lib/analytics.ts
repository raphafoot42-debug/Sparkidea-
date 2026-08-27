// Construction des séries pour la page Analyse.
//
// Règle importante pour les métriques déclarées au check-in (clients, revenu,
// audience) : si l'utilisateur n'a pas fait de check-in un jour donné, on ne
// met PAS 0 sur le graphique — on reporte la dernière valeur connue (il n'a
// pas perdu tous ses abonnés du jour au lendemain, il n'a juste rien déclaré).
// Les quêtes, elles, sont un cumul naturel (nombre de quêtes complétées à date),
// donc pas besoin de report : le cumul ne redescend jamais tout seul.

export type Period = "day" | "week" | "month" | "year";

const BUCKET_COUNT: Record<Period, number> = {
  day: 14,
  week: 10,
  month: 12,
  year: 5,
};

function startOfBucket(date: Date, period: Period): Date {
  const d = new Date(date);
  if (period === "day") {
    d.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    const day = d.getDay(); // 0 = dimanche
    const diffToMonday = (day + 6) % 7;
    d.setDate(d.getDate() - diffToMonday);
    d.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
  } else {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function nextBucket(date: Date, period: Period): Date {
  const d = new Date(date);
  if (period === "day") d.setDate(d.getDate() + 1);
  else if (period === "week") d.setDate(d.getDate() + 7);
  else if (period === "month") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function bucketLabel(date: Date, period: Period): string {
  if (period === "day") return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (period === "week") return `Sem. ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  if (period === "month") return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  return date.getFullYear().toString();
}

function buildBucketStarts(period: Period): Date[] {
  const count = BUCKET_COUNT[period];
  const now = new Date();
  const lastStart = startOfBucket(now, period);
  const starts: Date[] = [];
  let cursor = lastStart;
  for (let i = 0; i < count; i++) {
    starts.unshift(cursor);
    cursor = new Date(cursor);
    if (period === "day") cursor.setDate(cursor.getDate() - 1);
    else if (period === "week") cursor.setDate(cursor.getDate() - 7);
    else if (period === "month") cursor.setMonth(cursor.getMonth() - 1);
    else cursor.setFullYear(cursor.getFullYear() - 1);
  }
  return starts;
}

export type QuestPoint = { completedAt: Date; track: "marketing" | "technique" };
export type CheckInPoint = { createdAt: Date; clients: number; revenue: number; audience: number };

export type SeriesResult = {
  labels: string[];
  totalQuests: number[];
  marketingQuests: number[];
  techniqueQuests: number[];
  clients: number[];
  revenue: number[];
  audience: number[];
};

export function buildAnalyticsSeries(
  period: Period,
  quests: QuestPoint[],
  checkIns: CheckInPoint[]
): SeriesResult {
  const starts = buildBucketStarts(period);
  const labels = starts.map((s) => bucketLabel(s, period));

  // Quêtes : cumul de quêtes complétées jusqu'à la fin de chaque bucket.
  const totalQuests: number[] = [];
  const marketingQuests: number[] = [];
  const techniqueQuests: number[] = [];

  // Check-ins triés, pour retrouver la dernière valeur connue à une date donnée.
  const sortedCheckIns = [...checkIns].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const clients: number[] = [];
  const revenue: number[] = [];
  const audience: number[] = [];

  for (const start of starts) {
    const end = nextBucket(start, period);

    const doneUpToEnd = quests.filter((q) => q.completedAt.getTime() < end.getTime());
    totalQuests.push(doneUpToEnd.length);
    marketingQuests.push(doneUpToEnd.filter((q) => q.track === "marketing").length);
    techniqueQuests.push(doneUpToEnd.filter((q) => q.track === "technique").length);

    // Dernier check-in strictement avant la fin du bucket → report (fill-forward).
    // S'il n'y en a aucun encore, on reste à 0 (rien déclaré pour l'instant).
    let last: CheckInPoint | null = null;
    for (const c of sortedCheckIns) {
      if (c.createdAt.getTime() < end.getTime()) last = c;
      else break;
    }
    clients.push(last?.clients ?? 0);
    revenue.push(last?.revenue ?? 0);
    audience.push(last?.audience ?? 0);
  }

  return { labels, totalQuests, marketingQuests, techniqueQuests, clients, revenue, audience };
}
