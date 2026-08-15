"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedGrid } from "@/components/AnimatedGrid";

const TESTIMONIALS = [
  {
    initials: "CR",
    name: "Camille R.",
    plan: "forfait momentum",
    color: "#5DCAA5",
    // Catégorie utilisée pour faire remonter le témoignage le plus pertinent
    // en fonction du point faible détecté dans le schéma du client — voir
    // pickPriorityCategory ci-dessous.
    category: "general" as const,
    text: "Je tournais en rond depuis des mois. Les points d'avancement m'ont obligée à avancer chaque semaine au lieu de juste y penser. J'ai mes 50 premiers clients.",
  },
  {
    initials: "YB",
    name: "Yanis B.",
    plan: "forfait élite",
    color: "#AFA9EC",
    category: "marketing" as const,
    text: "L'onglet analyse m'a fait comprendre que je passais trop de temps sur le technique, pas assez sur le marketing. Réajusté en une semaine, résultat direct.",
  },
  {
    initials: "ST",
    name: "Sarah T.",
    plan: "forfait découverte",
    color: "#F0997B",
    category: "concurrence" as const,
    text: "J'ai pris le petit forfait juste pour tester si mon idée tenait debout. Le schéma a pointé un truc que j'avais zappé face à la concurrence. Ça m'a évité de perdre du temps.",
  },
];

// Fait remonter en premier le témoignage le plus pertinent par rapport au
// critère le plus faible du schéma du client — sinon, ordre par défaut.
function pickPriorityCategory(criteria: Record<string, { score: number }> | null): "marketing" | "concurrence" | "general" {
  if (!criteria) return "general";
  const entries = Object.entries(criteria);
  if (entries.length === 0) return "general";
  const [worstKey] = entries.sort((a, b) => a[1].score - b[1].score)[0];
  if (worstKey.includes("concurrence")) return "concurrence";
  if (worstKey.includes("différenciation") || worstKey.includes("revenu")) return "marketing";
  return "general";
}

export default function WelcomePage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [orderedTestimonials, setOrderedTestimonials] = useState(TESTIMONIALS);

  // Lecture seule du schéma déjà généré (voir generateSchema côté serveur) —
  // sert à personnaliser le pilier "Vision claire" avec le vrai score, et à
  // faire remonter le témoignage le plus pertinent selon le point faible
  // détecté. La suppression du sessionStorage a lieu dans handleStart, une
  // fois le projet sauvegardé.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("spark_pending_schema");
      const pending = raw ? JSON.parse(raw) : null;
      if (typeof pending?.schema?.overallScore === "number") {
        setScore(pending.schema.overallScore);
      }
      const priority = pickPriorityCategory(pending?.schema?.criteria ?? null);
      if (priority !== "general") {
        setOrderedTestimonials([
          ...TESTIMONIALS.filter((t) => t.category === priority),
          ...TESTIMONIALS.filter((t) => t.category !== priority),
        ]);
      }
    } catch {
      // Pas de schéma en attente (inscription directe) : piliers/ordre par défaut.
    }
  }, []);

  // Démarre le dashboard en essai gratuit 24h (voir lib/trial.ts) : on
  // récupère le schéma généré avant inscription s'il existe (sessionStorage),
  // on le sauvegarde une bonne fois pour toutes, puis direction le dashboard
  // — plus de détour obligatoire par les forfaits à cette étape.
  async function handleStart() {
    setStarting(true);
    try {
      const raw = sessionStorage.getItem("spark_pending_schema");
      const pending = raw ? JSON.parse(raw) : null;
      await fetch("/api/ideas/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pending
            ? { rawInput: pending.rawInput, schemaData: pending.schema }
            : { rawInput: "", schemaData: null }
        ),
      });
      sessionStorage.removeItem("spark_pending_schema");
    } catch {
      // Même si la sauvegarde échoue, on laisse l'utilisateur entrer sur son
      // dashboard — il pourra créer un projet manuellement depuis /dashboard/new.
    }
    router.push("/dashboard");
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatedGrid intensity="discrete" />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 720,
          margin: "0 auto",
          padding: "80px 20px 60px",
        }}
      >
        {/* Bloc 1 : Ce qui va se passer */}
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--line)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Ce qui va se passer
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10, lineHeight: 1.35 }}>
          Tu ne seras plus jamais seul face à ton idée.
        </h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 32, lineHeight: 1.65, maxWidth: 560 }}>
          On ne te promet pas la réussite. Mais on t&apos;aidera à l&apos;attraper. Pas à pas, on te suit vers ton
          objectif. On t&apos;aide à prendre les bons chemins, pour t&apos;éviter les murs inutiles.
        </p>

        <div style={{ height: 1, background: "var(--border)", marginBottom: 28 }} />

        {/* Bloc 2 : Comment ça marche */}
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--line)",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Comment ça marche
        </div>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, lineHeight: 1.65, maxWidth: 560 }}>
          Trois piliers t&apos;accompagnent tout au long du projet — chacun a un rôle précis pour te faire
          avancer, semaine après semaine.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Point d&apos;avancement</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Un check-in régulier, à ton rythme.</div>
          </div>
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Plan ajusté</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Le chemin bouge avec ta progression réelle.</div>
          </div>
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              {score !== null ? `Score de ton projet : ${score}/10` : "Vision claire"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {score !== null
                ? "On va bosser précisément sur ce chiffre, semaine après semaine."
                : "Chiffres et progression, pas des impressions."}
            </div>
          </div>
        </div>

        {/* Avis clients */}
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--line)",
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          Ils ont testé Spark Idea
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 40,
          }}
        >
          {orderedTestimonials.map((t) => (
            <div key={t.name} className="panel" style={{ padding: 16 }}>
              <div style={{ color: t.color, fontSize: 12, letterSpacing: 2, marginBottom: 10 }}>★★★★★</div>
              <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 14 }}>
                &quot;{t.text}&quot;
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `1.5px solid ${t.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.color,
                  }}
                >
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>Client vérifié ✓</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleStart} disabled={starting} className="btn-primary" style={{ width: "100%" }}>
          {starting ? "Un instant..." : "Commencer mon essai gratuit (24h) →"}
        </button>
      </div>
    </div>
  );
}
