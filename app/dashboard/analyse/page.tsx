import { hasDashboardAccess } from "@/lib/trial";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DrawerNav } from "@/components/DrawerNav";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { AnalyseClient } from "@/components/AnalyseClient";
import { generateProjectAnalysis } from "@/lib/ai/analysis-generator";
import type { SchemaResult } from "@/lib/ai/schema-generator";
 
export default async function AnalysePage({
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
  if (allIdeas.length === 0) redirect("/dashboard");

  const idea = searchParams.idea
    ? await db.idea.findFirst({ where: { id: searchParams.idea, userId: user.id } })
    : await db.idea.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  const activeIdea = idea ?? (await db.idea.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }))!;

  const [quests, checkIns] = await Promise.all([
    db.quest.findMany({
      where: { ideaId: activeIdea.id, status: "DONE", completedAt: { not: null } },
      select: { completedAt: true, track: true },
    }),
    db.checkIn.findMany({ where: { ideaId: activeIdea.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const latest = checkIns[checkIns.length - 1];
  const schema = JSON.parse(activeIdea.schemaData) as SchemaResult;

  const analysis = await generateProjectAnalysis(schema, {
    totalDone: quests.length,
    marketingDone: quests.filter((q) => q.track === "marketing").length,
    techniqueDone: quests.filter((q) => q.track === "technique").length,
    latestClients: latest?.clients ?? 0,
    latestRevenue: latest?.revenue ?? 0,
    latestAudience: latest?.audience ?? 0,
    checkInCount: checkIns.length,
  });

  return (
    <div style={{ position: "relative" }}>
      <AnimatedGrid intensity="discrete" />
      <DrawerNav />

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
        <ProjectSwitcher projects={allIdeas} activeIdeaId={activeIdea.id} />
      </div>

      <AnalyseClient
        ideaId={activeIdea.id}
        analysis={analysis}
        quests={quests.map((q) => ({
          completedAt: (q.completedAt as Date).toISOString(),
          track: q.track as "marketing" | "technique",
        }))}
        checkIns={checkIns.map((c) => ({
          createdAt: c.createdAt.toISOString(),
          clients: c.clients,
          revenue: c.revenue,
          audience: c.audience,
        }))}
      />
    </div>
  );
}
