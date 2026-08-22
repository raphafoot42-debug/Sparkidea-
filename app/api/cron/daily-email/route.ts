import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resend } from "@/lib/email/resend";
import { buildDailyDigestEmail } from "@/lib/email/daily-digest";

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
      // marche sans configurer de domaine. Limitée en volume et moins pro
      // pour l'utilisateur final — à remplacer par une adresse sur ton
      // propre domaine (ex: hello@spark-idea.app) une fois un domaine
      // vérifié dans Resend (Domains → Add Domain → enregistrements DNS).
      await resend.emails.send({
        from: "Spark Idea <onboarding@resend.dev>",
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
