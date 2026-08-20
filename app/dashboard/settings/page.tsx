import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AnimatedGrid } from "@/components/AnimatedGrid";
import { DrawerNav } from "@/components/DrawerNav";
import { SettingsClient } from "@/components/SettingsClient";
import { hasDashboardAccess } from "@/lib/trial";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { blocked?: string };
}) {
  // Vérification serveur réelle — avant, cette page était un composant
  // client sans aucun contrôle d'accès : n'importe qui pouvait la charger
  // et voir les mêmes options qu'un client payant, connecté ou pas.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const blocked = searchParams.blocked === "1" || !hasDashboardAccess(user);

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatedGrid intensity="discrete" />
      <DrawerNav />

      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", padding: "80px 20px 40px" }}>
        <SettingsClient
          blocked={blocked}
          subscriptionStatus={user.subscriptionStatus}
          email={user.email}
          theme={user.theme as "dark" | "light"}
          language={user.language as "fr" | "en" | "ja" | "ru"}
        />
      </div>
    </div>
  );
}
