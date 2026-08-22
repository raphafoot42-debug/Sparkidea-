import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { AdminTable } from "./AdminTable";
import { AdminLogoutButton } from "./AdminLogoutButton";

const PLAN_PRICE_EUR: Record<string, number> = { STARTER: 19, PRO: 49, STUDIO: 97 };

export default async function AdminPage() {
  if (!verifyAdminSession()) redirect("/admin/login");

  const users = await db.user.findMany({
    where: { plan: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { ideas: { select: { id: true } } },
  });

  const revenue = users.reduce((sum: number, u) => {
    if (u.subscriptionStatus !== "ACTIVE") return sum;
    return sum + (u.plan ? PLAN_PRICE_EUR[u.plan] ?? 0 : 0);
  }, 0);

  const starterCount = users.filter((u) => u.plan === "STARTER").length;
  const proCount = users.filter((u) => u.plan === "PRO").length;
  const studioCount = users.filter((u) => u.plan === "STUDIO").length;

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatedGrid intensity="discrete" />
      <div style={{ position: "relative", zIndex: 2, padding: "40px 44px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>Utilisateurs</h1>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>
              Le mot de passe n&apos;est jamais stocké en clair, ni visible ici
            </p>
          </div>
          <AdminLogoutButton />
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
          <Stat value={users.length} label="Utilisateurs payants" />
          <Stat value={`${revenue} €`} label="Revenu mensuel (MRR)" />
          <Stat value={`${starterCount} / ${proCount} / ${studioCount}`} label="Starter / Builder / Visionary" />
        </div>

        <AdminTable
          users={users.map((u) => ({
            id: u.id,
            email: u.email,
            plan: u.plan,
            subscriptionStatus: u.subscriptionStatus,
            createdAt: u.createdAt.toISOString(),
            lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
            ideasCount: u.ideas.length,
          }))}
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="panel" style={{ padding: "14px 18px", minWidth: 150 }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
