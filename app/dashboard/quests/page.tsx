import { hasDashboardAccess } from "@/lib/trial";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DrawerNav } from "@/components/DrawerNav";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { AllQuestsClient } from "@/components/AllQuestsClient";
import { GoalOnboarding } from "@/components/GoalOnboarding";
import { GoalStrip } from "@/components/GoalStrip";
import { ensureQuestBatch } from "@/lib/quests";
import { computeTechnicalProgress } from "@/lib/progress"; 
import type { SchemaResult } from "@/lib/ai/schema-generator";

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: { idea?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasDashboardAccess(user)) redirect("/dashboard/settings?blocked=1");

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

  if (!idea) redirect("/dashboard/new");

  const schema = JSON.parse(idea.schemaData) as SchemaResult;

  // Tant que l'utilisateur n'a pas fixé son but final lui-même, on ne génère
  // aucune quête et on affiche l'écran de saisie à la place.
  if (!idea.finalGoal) {
    return (
      <div style={{ position: "relative", minHeight: "100vh" }}>
        <AnimatedGrid intensity="discrete" />
        <DrawerNav />
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "80px 20px 60px",
          }}
        >
          <GoalOnboarding ideaId={idea.id} projectTitle={schema.projectTitle} />
        </div>
      </div>
    );
  }

  try {
    await ensureQuestBatch(idea.id, schema);
  } catch (err) {
    console.error("[dashboard/quests] Erreur génération des quêtes :", err);
  }

  // Toutes les quêtes, faites et à faire, dans l'ordre chronologique — c'est
  // la roadmap complète "de A à Z" demandée.
  const quests = await db.quest.findMany({
    where: { ideaId: idea.id },
    orderBy: [{ createdAt: "asc" }, { order: "asc" }],
  });

  const technicalProgress = await computeTechnicalProgress(idea.id);

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatedGrid intensity="discrete" />
      <DrawerNav />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "80px 20px 60px",
        }}
      >
        {idea.finalGoal && (
          <GoalStrip
            ideaId={idea.id}
            goals={(idea.goals.length > 0 ? idea.goals : [{
              id: `${idea.id}-initial`,
              text: idea.finalGoal,
            }]).map((goal) => ({ id: goal.id, text: goal.text }))}
          />
        )}
        <AllQuestsClient
          projectTitle={schema.projectTitle}
          activeIdeaId={idea.id}
          technicalProgress={technicalProgress}
          quests={quests.map((q) => ({
            id: q.id,
            title: q.title,
            detail: q.detail,
            track: q.track as "marketing" | "technique",
            status: q.status as "PENDING" | "DONE",
          }))}
        />
      </div>
    </div>
  );
}
