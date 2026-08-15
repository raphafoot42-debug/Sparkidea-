import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DrawerNav } from "@/components/DrawerNav";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { MAX_IDEAS, toPlanKey } from "@/lib/plan-limits";
import { computeGlobalProgress } from "@/lib/progress";
import type { SchemaResult } from "@/lib/ai/schema-generator";

export default async function IdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ideas = await db.idea.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // FIX : ce fichier avait sa propre limite locale, désynchronisée de
  // lib/plan-limits.ts (10/5 au lieu des vraies limites 1/5/15) — corrigé
  // pour lire la même source que le reste de l'app.
  const maxIdeas = MAX_IDEAS[toPlanKey(user.plan)];

  const progressByIdea = Object.fromEntries(
    await Promise.all(ideas.map(async (idea) => [idea.id, await computeGlobalProgress(idea.id)] as const))
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatedGrid intensity="discrete" />
      <DrawerNav />

      <div style={{ position: "relative", zIndex: 2, padding: "80px 40px 40px", maxWidth: 700 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Historique</h1>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {ideas.length} / {maxIdeas} utilisées
          </span>
        </div>

        {ideas.map((idea) => {
          const schema = JSON.parse(idea.schemaData) as SchemaResult;
          return (
            <Link
              key={idea.id}
              href={`/dashboard?idea=${idea.id}`}
              className="panel"
              style={{
                display: "block",
                padding: "16px 20px",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{schema.projectTitle}</div>
                <div style={{ fontSize: 12, color: "var(--line)" }}>{schema.overallScore}/10</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {idea.rawInput.slice(0, 80)}
                {idea.rawInput.length > 80 ? "..." : ""}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Avancée du projet</span>
                  <span style={{ fontSize: 10.5, color: "var(--line)", fontWeight: 600 }}>
                    {progressByIdea[idea.id]}%
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progressByIdea[idea.id]}%`,
                      background: "linear-gradient(90deg,#22d3ee,#a855f7)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {ideas.length < maxIdeas && (
          <Link href="/dashboard/new" className="btn-secondary" style={{ display: "inline-block", marginTop: 8 }}>
            + Nouveau projet
          </Link>
        )}
      </div>
    </div>
  );
}
