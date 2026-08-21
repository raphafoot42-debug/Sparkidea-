import { hasDashboardAccess } from "@/lib/trial";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db"; 
import { DrawerNav } from "@/components/DrawerNav";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { QuestChatClient } from "@/components/QuestChatClient";
import { QUEST_CHAT_MESSAGE_LIMITS, startOfCurrentMonth, toPlanKey } from "@/lib/plan-limits";

export default async function AiPage({
  searchParams,
}: {
  searchParams: { idea?: string; questId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasDashboardAccess(user)) redirect("/dashboard/settings?blocked=1");

  const idea = searchParams.idea
    ? await db.idea.findFirst({ where: { id: searchParams.idea, userId: user.id } })
    : await db.idea.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  const quests = idea
    ? await db.quest.findMany({
        where: { ideaId: idea.id, status: "PENDING" },
        orderBy: { order: "asc" },
      })
    : [];

  const planKey = toPlanKey(user.plan);
  const limit = QUEST_CHAT_MESSAGE_LIMITS[planKey];
  const usedThisMonth = await db.usageLog.count({
    where: { userId: user.id, source: "quest", createdAt: { gte: startOfCurrentMonth() } },
  });

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
        <QuestChatClient
          quests={quests.map((q) => ({ id: q.id, title: q.title, detail: q.detail }))}
          initialQuestId={searchParams.questId}
          quota={{ used: usedThisMonth, limit }}
        />
      </div>
    </div>
  );
}
