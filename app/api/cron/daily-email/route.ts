import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { buildDailyDigestEmail } from "@/lib/email/daily-digest";

export const dynamic = "force-dynamic";

// Appelé une fois par jour par le cron Vercel (voir vercel.json).
// Si CRON_SECRET est défini dans Vercel, la route vérifie le header envoyé
// automatiquement par Vercel Cron. Si CRON_SECRET n'est pas défini, la
// vérification est simplement ignorée (moins sûr, mais fonctionnel sans
// configuration supplémentaire).
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      ideas: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          title: true,
          quests: {
            where: { status: "PENDING" },
            orderBy: { order: "asc" },
            take: 2,
            select: { title: true, track: true },
          },
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const latestIdea = user.ideas[0];
    const { subject, html } = buildDailyDigestEmail({
      userId: user.id,
      ideaTitle: latestIdea?.title ?? null,
      quests: latestIdea?.quests ?? [],
    });

    try {
      // "onboarding@resend.dev" = adresse de test fournie par Resend, qui
      // Solution temporaire via Gmail (voir lib/email/send.ts) — Resend
      // seul ne marche pas sans domaine vérifié pour envoyer à autre chose
      // que l'adresse du compte Resend lui-même. À remplacer une fois un
      // domaine vérifié (Resend → Domains → Add Domain → enregistrements
      // DNS) : il suffira de changer lib/email/send.ts, rien d'autre ici.
      await sendEmail({
        to: user.email,
        subject,
        html,
      });
      sent++;
    } catch (err) {
      console.error(`Échec envoi email pour ${user.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: users.length });
}
