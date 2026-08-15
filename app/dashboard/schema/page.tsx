import { redirect } from "next/navigation";

// Le schéma est maintenant affiché directement sur /dashboard, en dessous de
// la quête du jour — cette route ne sert plus qu'à rediriger les anciens liens.
export default function SchemaRedirectPage({
  searchParams,
}: {
  searchParams: { idea?: string };
}) {
  redirect(searchParams.idea ? `/dashboard?idea=${searchParams.idea}` : "/dashboard");
}
