"use client";

import { useState } from "react";
import { MindMap } from "@/components/MindMap";
import type { SchemaResult } from "@/lib/ai/schema-generator";

type Props = {
  ideaId: string;
  initialSchema: SchemaResult;
  hasRevenue?: boolean;
};

// Composant client : la Vue principale est maintenant directement la carte
// mentale interactive branchée à l'IA, isolée sur ce projet précis (ideaId),
// comme décidé — plus la version "cartes empilées" provisoire du début.
export function DashboardClient({ ideaId, initialSchema, hasRevenue }: Props) {
  const [schema, setSchema] = useState(initialSchema);
  return <MindMap schema={schema} onSchemaChange={setSchema} ideaId={ideaId} hasRevenue={hasRevenue} />;
}
