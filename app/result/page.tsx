"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MindMap } from "@/components/MindMap";
import { AnimatedScore } from "@/components/AnimatedScore";
import type { SchemaResult } from "@/lib/ai/schema-generator";
 
export default function ResultPage() {
  const router = useRouter();
  const [schema, setSchema] = useState<SchemaResult | null>(null);
  const [verdict, setVerdict] = useState("");
  const [verdictOpen, setVerdictOpen] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("spark_pending_schema");
    if (!raw) {
      router.push("/");
      return;
    }
    const parsed = JSON.parse(raw);
    setSchema(parsed.schema);
    if (parsed.verdict) setVerdict(parsed.verdict);
  }, [router]);

  function handleSchemaChange(updated: SchemaResult) {
    setSchema(updated);
    const raw = sessionStorage.getItem("spark_pending_schema");
    if (raw) {
      const parsed = JSON.parse(raw);
      sessionStorage.setItem(
        "spark_pending_schema",
        JSON.stringify({ ...parsed, schema: updated })
      );
    }
  }

  function handleVoirPlus() {
    router.push("/signup");
  }

  if (!schema) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
        Chargement...
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <MindMap
        schema={schema}
        onSchemaChange={handleSchemaChange}
        freeMode
        onVoirPlus={handleVoirPlus}
      />

      {/* Verdict honnête et personnalisé (voir generateVerdict), affiché dès
          que le schéma arrive — AVANT l'inscription, à la demande de
          Raphaël, pas plus tard sur /welcome. Repliable pour ne pas gêner
          la lecture du schéma en dessous, à gauche pour ne pas chevaucher
          le panneau "Analyse en direct" de MindMap (fixé à droite). */}
      {verdict && (
        <div
          className="panel"
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 15,
            width: verdictOpen ? "min(340px, calc(100vw - 32px))" : "auto",
            padding: 14,
            borderColor: scoreColor(schema.overallScore),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              cursor: "pointer",
              marginBottom: verdictOpen ? 8 : 0,
            }}
            onClick={() => setVerdictOpen((v) => !v)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: scoreColor(schema.overallScore),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: scoreColor(schema.overallScore),
                  fontWeight: 600,
                }}
              >
                Notre avis honnête — <AnimatedScore value={schema.overallScore} />/10
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{verdictOpen ? "▲" : "▼"}</span>
          </div>
          {verdictOpen && (
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#cbd5e1", maxHeight: 220, overflowY: "auto", whiteSpace: "pre-wrap" }}>
              {verdict}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Vert / orange / rouge selon le score global — lisible en un coup d'œil
// avant même de lire le texte du verdict.
function scoreColor(score: number): string {
  if (score >= 7) return "var(--success)";
  if (score >= 4.5) return "#f59e0b";
  return "var(--danger)";
}
