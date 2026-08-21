import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { SchemaResult } from "@/lib/ai/schema-generator";
import { ExportPngButton } from "@/components/ExportPngButton";

// Page PUBLIQUE (pas d'auth) — accessible à quiconque a le lien exact avec
// le bon token, comme demandé : "un lien de partage en lecture seule".
// Aucune action possible ici (pas de chat, pas d'édition) : uniquement la 
// consultation du schéma déjà généré.
export default async function SharePage({ params }: { params: { token: string } }) {
  const idea = await db.idea.findUnique({ where: { shareToken: params.token } });
  if (!idea) notFound();

  // Compteur de vues (idée 2) : incrémenté à chaque ouverture de la page —
  // simple et suffisant pour un indicateur social, pas un système
  // d'analytics précis (un même visiteur qui recharge compte plusieurs fois).
  await db.idea.update({ where: { id: idea.id }, data: { shareViews: { increment: 1 } } });

  const schema = JSON.parse(idea.schemaData) as SchemaResult;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "50px 20px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Analyse partagée — lecture seule
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          {schema.projectTitle}
        </h1>
        <div style={{ fontSize: 14, color: "var(--line)", marginBottom: 28 }}>
          Score global : {schema.overallScore}/10
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 32 }}>
          {Object.entries(schema.criteria).map(([key, c]) => (
            <div key={key} className="panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textTransform: "capitalize" }}>{key}</span>
                <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{c.score}/5</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{c.note}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {schema.nodes.map((n) => (
            <div key={n.id} className="panel" style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                  color: n.type === "todo" ? "var(--line)" : n.type === "risk" ? "var(--danger)" : "var(--success)",
                }}
              >
                {n.type === "todo" ? "À faire" : n.type === "risk" ? "Vigilance" : "Opportunité"}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{n.label}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{n.comment}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <ExportPngButton schema={schema} />
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--muted)" }}>
          {idea.shareViews + 1} personne{idea.shareViews + 1 > 1 ? "s ont" : " a"} déjà vu cette analyse
        </div>

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12.5, color: "var(--muted)" }}>
          Généré avec{" "}
          <a href="/" style={{ color: "var(--line)" }}>
            Spark Idea
          </a>
        </div>
      </div>
    </div>
  );
}
