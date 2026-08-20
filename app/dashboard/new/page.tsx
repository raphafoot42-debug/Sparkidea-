import { hasDashboardAccess } from "@/lib/trial";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { DrawerNav } from "@/components/DrawerNav";
import { NewIdeaClient } from "@/components/NewIdeaClient";

export default async function NewIdeaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasDashboardAccess(user)) redirect("/dashboard/settings?blocked=1");

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatedGrid intensity="discrete" />
      <DrawerNav />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px 40px" }}>
        <NewIdeaClient />
      </div>
    </div>
  );
}
