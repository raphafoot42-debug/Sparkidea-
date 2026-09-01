import { hasDashboardAccess } from "@/lib/trial";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DrawerNav } from "@/components/DrawerNav";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { DashboardClient } from "@/components/DashboardClient";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { ensureQuestBatch } from "@/lib/quests";
import { computeGlobalProgress } from "@/lib/progress";
import { PrestigeClient } from "@/components/PrestigeClient";
import { TrialBanner } from "@/components/TrialBanner";
import { ShareButton } from "@/components/ShareButton";
import type { SchemaResult } from "@/lib/ai/schema-generator"; 

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { idea?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!hasDashboardAccess(user)) {
    redirect("/dashboard/settings?blocked=1");
  }

  const allIdeas = await db.idea.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  if (allIdeas.length === 0) {
    return (
      <div style={{ position: "relative", minHeight: "100vh" }}>
        <AnimatedGrid intensity="discrete" />
        <DrawerNav />
        <div style={{ position: "relative", zIndex: 2, padding: "80px 40px" }}>
          {user.subscriptionStatus === "TRIAL" && (
            <TrialBanner trialStartedAt={user.trialStartedAt} trialMessagesUsed={user.trialMessagesUsed} />
          )}
          <p style={{ color: "var(--muted)" }}>
            Aucune idée pour l&apos;instant.{" "}
            <Link href="/dashboard/new" style={{ color: "var(--line)" }}>
              Crée-en une →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const idea = searchParams.idea
    ? await db.idea.findFirst({
        where: { id: searchParams.idea, userId: user.id },
        include: { goals: { orderBy: { createdAt: "asc" } } },
      })
    : await db.idea.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: { goals: { orderBy: { createdAt: "asc" } } },
      });

  const activeIdea = idea ?? (await db.idea.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { goals: { orderBy: { createdAt: "asc" } } },
  }))!;

  const schema = JSON.parse(activeIdea.schemaData) as SchemaResult;

  try {
    await ensureQuestBatch(activeIdea.id, schema);
  } catch (err) {
    console.error("[dashboard] Erreur génération des quêtes :", err);
  }

  const progress = await computeGlobalProgress(activeIdea.id);

  return (
    <div style={{ position: "relative" }}>
      <AnimatedGrid intensity="discrete" />
      <DrawerNav />

      {/* Sélecteur de projet + bouton vers la quête du jour — en haut de page */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "80px 20px 24px",
        }}
      >
        {user.subscriptionStatus === "TRIAL" && (
          <div style={{ width: "100%", maxWidth: 640 }}>
            <TrialBanner trialStartedAt={user.trialStartedAt} trialMessagesUsed={user.trialMessagesUsed} />
          </div>
        )}
        <div style={{ width: "100%", maxWidth: 640, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {activeIdea.shareToken && activeIdea.shareViews > 0 && (
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
              Lien consulté {activeIdea.shareViews} fois
            </span>
          )}
          <ShareButton />
        </div>
        <ProjectSwitcher projects={allIdeas} activeIdeaId={activeIdea.id} />
        <Link
          href={`/dashboard/quests?idea=${activeIdea.id}`}
          className="btn-primary"
          style={{ marginTop: 16, display: "inline-block" }}
        >
          Quête du jour →
        </Link>
        {progress >= 100 && <PrestigeClient ideaId={activeIdea.id} />}
      </div>

      {/* Le schéma complet (carte mentale), directement en dessous, même page */}
      <div style={{ position: "relative", zIndex: 2, borderTop: "1px solid var(--border)" }}>
        <div style={{ textAlign: "center", padding: "18px 20px 0", fontSize: 12, color: "var(--muted)" }}>
          Schéma complet du projet
        </div>
        <DashboardClient ideaId={activeIdea.id} initialSchema={schema} />
      </div>
    </div>
  );
}
