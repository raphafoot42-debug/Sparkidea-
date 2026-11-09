"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatedGrid } from "@/components/AnimatedGrid"; 
import { AnimatedNumber } from "@/components/AnimatedNumber";
import type { SchemaResult } from "@/lib/ai/schema-generator";
import { MAX_CLARIFYING_QUESTIONS } from "@/lib/qa-constants";

type QaTurn = { question: string; answer: string };

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode "questions" : une fois l'idée soumise, l'IA pose ses questions de
  // clarification une par une avant de générer le schéma final (décidé avec
  // Raphaël — plus de schéma instantané suivi de questions après-coup).
  const [qaHistory, setQaHistory] = useState<QaTurn[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [started, setStarted] = useState(false);
  // Compteur social réel (voir /api/stats/count) — affiché seulement s'il
  // est assez parlant, pour ne jamais montrer un "+2" qui ferait vide.
  const [monthlyCount, setMonthlyCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats/count")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.count === "number" && data.count >= 5) setMonthlyCount(data.count);
      })
      .catch(() => {
        // Purement décoratif : un échec ici ne doit jamais gêner la page d'accueil.
      });
  }, []);

  useEffect(() => {
    fetch("/api/hero-image")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.url === "string") setHeroImageUrl(data.url);
      })
      .catch(() => {
        // Purement décoratif : sans clé Pexels ou en cas d'échec, la page
        // reste identique, juste sans l'image — jamais bloquant.
      });
  }, []);

  // Tracking des clics venant du programme d'affiliation Spark Idea (site
  // séparé, spark-idea-6.vercel.app) : si quelqu'un arrive ici avec
  // ?ref=CODE, on prévient ce site que le lien de cet affilié a été ouvert.
  // Lecture directe de l'URL (pas useSearchParams : ce hook impose un
  // <Suspense> autour de toute la page en App Router, on l'évite ici pour
  // ne pas restructurer tout le composant).
  const [refCode, setRefCode] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRefCode(params.get("ref"));
  }, []);

  // Avertit avant de fermer/recharger l'onglet en plein milieu des questions
  // (avant que le schéma soit prêt) — ne se déclenche jamais sur une
  // navigation interne (router.push vers /result), seulement sur une vraie
  // fermeture/rechargement de la page.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (started) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [started]);
  // Réponse refusée car pas assez claire (voir checkAnswerClarity côté
  // serveur) — affichée sous la question, la même question reste posée.
  const [clarityError, setClarityError] = useState<string | null>(null);

  async function callGenerate(history: QaTurn[], pendingAnswer?: QaTurn) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea, name, qaHistory: history, pendingAnswer }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    if (data.type === "question") {
      if (data.clarityError) {
        // Réponse refusée : on garde la même question affichée, l'utilisateur
        // corrige sa réponse dans le même champ.
        setClarityError(data.clarityError as string);
        setLoading(false);
        return;
      }
      // Réponse acceptée (ou tout premier appel) : on avance à la question suivante.
      if (pendingAnswer) setQaHistory([...history, pendingAnswer]);
      setClarityError(null);
      setCurrentQuestion(data.question as string);
      setAnswer("");
      setLoading(false);
      return;
    }

    // type === "schema" : prêt, on garde le résultat en mémoire de session
    // le temps que l'utilisateur s'inscrive — rien n'est en base avant ça.
    sessionStorage.setItem(
      "spark_pending_schema",
      JSON.stringify({
        schema: data.schema as SchemaResult,
        rawInput: idea,
        name,
        verdict: (data.verdict as string) ?? "",
      })
    );
    router.push("/result");
  }

  async function handleSubmit() {
    if (idea.trim().length < 6) return;
    setStarted(true);
    setLoading(true);
    setError(null);
    try {
      await callGenerate([]);
    } catch {
      setError("Impossible de contacter le serveur. Réessaie.");
      setLoading(false);
    }
  }

  async function handleAnswerSubmit() {
    if (!currentQuestion || answer.trim().length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await callGenerate(qaHistory, { question: currentQuestion, answer: answer.trim() });
    } catch {
      setError("Impossible de contacter le serveur. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      {refCode && (
        <img
          src={`https://spark-idea-6.vercel.app/api/track-click?code=${refCode}`}
          width={1}
          height={1}
          style={{ display: "none" }}
          alt=""
        />
      )}
      <AnimatedGrid intensity="intense" />

      {/* Lueur douce derrière le titre — donne de la profondeur et de la
          couleur sans réintroduire d'animation qui capte l'attention en
          continu (retiré plus tôt dans le projet). Statique, discrète. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          background: "radial-gradient(closest-side, rgba(34,211,238,0.16), rgba(168,85,247,0.08), transparent)",
          filter: "blur(40px)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 20,
          left: 24,
          right: 24,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600 }}>◆ Spark Idea</div>
        <a href="/login" className="btn-secondary" style={{ borderRadius: 20 }}>
          Connexion
        </a>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10vh 24px 6vh",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginBottom: 22,
          }}
        >
          Spark Idea
        </div>

        <h1
          style={{
            fontSize: "clamp(30px, 5vw, 52px)",
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 760,
          }}
        >
          Ton idée,{" "}
          <span
            style={{
              background: "linear-gradient(90deg, var(--line), var(--line2))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ta destinée.
          </span>
        </h1>

        <p
          style={{
            marginTop: 18,
            fontSize: 15.5,
            color: "var(--muted)",
            textAlign: "center",
            maxWidth: 500,
            lineHeight: 1.6,
          }}
        >
          Décris ton idée de projet, réponds à quelques questions, obtiens un
          plan précis pour la lancer — gratuit, sans inscription.
        </p>

        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt=""
            style={{
              marginTop: 26,
              width: "100%",
              maxWidth: 480,
              maxHeight: 220,
              objectFit: "cover",
              borderRadius: 16,
              border: "1px solid var(--border)",
            }}
          />
        )}

        {monthlyCount !== null && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--line)" }}>
            +<AnimatedNumber value={monthlyCount} /> projets déjà analysés ce mois-ci
          </div>
        )}

        <div style={{ display: "flex", gap: 26, marginTop: 34, flexWrap: "wrap", justifyContent: "center" }}>
          {["Décris ton idée", "Reçois ton plan", "Passe à l'action"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)" }}>
              <span
                style={{
                  width: 19,
                  height: 19,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  color: "var(--text)",
                }}
              >
                {i + 1}
              </span>
              {s}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 42, fontSize: 13, color: "var(--muted)" }}>
          C&apos;est comment ton prénom ?
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            placeholder="Prénom"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255,255,255,0.2)",
              color: "var(--text)",
              fontSize: 13,
              padding: "4px 2px",
              width: 120,
              outline: "none",
              textAlign: "center",
            }}
          />
        </div>

        <div style={{ marginTop: 24, width: "100%", maxWidth: 600 }}>
          {!started && (
            <div
              className="panel"
              style={{ padding: 4, borderRadius: 16, position: "relative" }}
            >
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Ex : une appli qui aide les artisans à faire leurs devis en 2 minutes..."
                rows={2}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  color: "var(--text)",
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  padding: "15px 110px 15px 16px",
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={idea.trim().length < 6 || loading}
                className="btn-primary"
                style={{ position: "absolute", right: 8, bottom: 8 }}
              >
                {loading ? "Analyse..." : "Analyser →"}
              </button>
            </div>
          )}

          {started && (
            <div className="panel" style={{ padding: 20, borderRadius: 16 }}>
              {(currentQuestion || loading) && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14, letterSpacing: "0.04em" }}>
                  Question {Math.min(qaHistory.length + 1, MAX_CLARIFYING_QUESTIONS)} / {MAX_CLARIFYING_QUESTIONS}
                </div>
              )}
              {qaHistory.map((t, i) => (
                <div key={i} style={{ marginBottom: 14, fontSize: 13.5 }}>
                  <div style={{ color: "var(--muted)", marginBottom: 4 }}>{t.question}</div>
                  <div style={{ color: "var(--text)" }}>→ {t.answer}</div>
                </div>
              ))}

              {currentQuestion && !loading && (
                <div>
                  <div style={{ fontSize: 14.5, marginBottom: 6 }}>{currentQuestion}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                    Réponds avec le plus de détails possible — c&apos;est ce qui rend le schéma final vraiment précis.
                  </div>
                  {clarityError && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#f43f5e",
                        background: "rgba(244,63,94,0.08)",
                        border: "1px solid rgba(244,63,94,0.3)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        marginBottom: 10,
                      }}
                    >
                      {clarityError}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <textarea
                      value={answer}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        if (clarityError) setClarityError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAnswerSubmit();
                        }
                      }}
                      placeholder="Ta réponse... (Maj+Entrée pour aller à la ligne)"
                      rows={3}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 10,
                        color: "var(--text)",
                        fontSize: 14,
                        padding: "10px 12px",
                        outline: "none",
                        resize: "none",
                        fontFamily: "inherit",
                      }}
                    />
                    <button
                      onClick={handleAnswerSubmit}
                      disabled={answer.trim().length === 0}
                      className="btn-primary"
                    >
                      →
                    </button>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{ fontSize: 13.5, color: "var(--muted)" }}>
                  {qaHistory.length === 0 ? "Analyse en cours..." : "Un instant..."}
                </div>
              )}
            </div>
          )}

          {/* Aperçu flouté du schéma en construction : crée de l'anticipation
              pendant les questions, sans montrer de fausses infos puisque
              rien n'est encore généré à ce stade. */}
          {started && (
            <div style={{ marginTop: 16, opacity: 0.35, filter: "blur(1.5px)", pointerEvents: "none" }}>
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="panel"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    marginBottom: 8,
                    animation: `pulseGhost 1.8s ease-in-out ${n * 0.2}s infinite`,
                  }}
                >
                  <div style={{ height: 8, width: `${40 + n * 15}%`, background: "rgba(255,255,255,0.15)", borderRadius: 4 }} />
                </div>
              ))}
              <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                Ton schéma se construit en tâche de fond...
              </div>
            </div>
          )}
          <style>{`
            @keyframes pulseGhost {
              0%, 100% { opacity: 0.5; }
              50% { opacity: 1; }
            }
          `}</style>

          {error && <div className="error-text" style={{ textAlign: "center" }}>{error}</div>}
          {!started && (
            <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
              Aucune carte bancaire nécessaire pour voir ton plan
            </div>
          )}
        </div>
      </div>

      {/* Séquence "comment ça marche" — montre la transformation du projet
          plutôt que de la décrire en texte seul. Illustrations stylisées
          (pas de vraies captures d'écran : je n'ai jamais vu le produit
          tourner dans un navigateur, donc pas de fausse capture qui
          prétendrait être réelle — à remplacer par de vrais screenshots
          du produit dès que possible). */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "10vh 24px 6vh",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ textAlign: "center", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
          Comment ça marche
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 600, marginBottom: 40 }}>
          Ton idée, transformée étape par étape
        </h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 16,
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          {[
            {
              title: "Idée",
              desc: "Tu décris ton projet en une phrase.",
              icon: (
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <path d="M13 4a7 7 0 0 0-4 12.7V19a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 13 4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M10.5 23h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              title: "Analyse",
              desc: "L'IA étudie marché, cible, concurrence, monétisation.",
              icon: (
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M16 16l6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              title: "Schéma",
              desc: "Un plan visuel structuré : forces, risques, opportunités.",
              icon: (
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <circle cx="13" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="6" cy="20" r="3" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="20" cy="20" r="3" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M11.5 8.5 7.5 17.5M14.5 8.5l4 9" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              ),
            },
            {
              title: "Quêtes",
              desc: "Des actions concrètes chaque jour, techniques et marketing.",
              icon: (
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <rect x="4" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 13l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              title: "Assistant",
              desc: "Une IA qui connaît ton projet en permanence, prête à t'aider.",
              icon: (
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <path d="M5 6h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H12l-5 4v-4H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              title: "Progression",
              desc: "Tu suis tes clients, ton revenu, ton avancée réelle.",
              icon: (
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <path d="M3 20h20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <path d="M5 17l5-6 4 4 7-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
          ].map((step, i) => (
            <div key={step.title} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                className="panel"
                style={{
                  width: 168,
                  padding: "20px 16px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    color: "var(--line)",
                    background: "rgba(34,211,238,0.08)",
                  }}
                >
                  {step.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{step.desc}</div>
              </div>
              {i < 5 && (
                <span style={{ color: "var(--muted)", fontSize: 18, flexShrink: 0 }} className="landing-arrow">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vidéo de démonstration du produit — désactivée pour l'instant
          (commentée), le temps que Raphaël fournisse le fichier réel.
          Dès qu'il le donne : déposer le fichier dans /public sous le nom
          product-demo.mp4, puis décommenter ce bloc. Volontairement
          désactivé plutôt qu'affiché avec un src cassé, qui ferait plus
          mauvaise impression qu'une section absente. */}
      {/*
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "6vh 24px 10vh",
        }}
      >
        <div style={{ textAlign: "center", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          En vidéo
        </div>
        <h2 style={{ textAlign: "center", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 600, marginBottom: 28, maxWidth: 500 }}>
          Spark Idea en action, en moins de 2 minutes
        </h2>
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid var(--border)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            background: "var(--panel)",
          }}
        >
          <video
            controls
            preload="metadata"
            poster="/testimonials-dm.jpg"
            style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }}
          >
            <source src="/product-demo.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
      */}

      {/* Preuve sociale — vraies conversations clients, partagées avec
          autorisation. Avant, la landing n'avait aucun témoignage : le
          seul se trouvait après l'inscription (/welcome), jamais avant. */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "10vh 24px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>
          Ils l&apos;ont testé
        </div>
        <img
          src="/testimonials-dm.jpg"
          alt="Conversations réelles de clients Spark Idea, partagées avec leur autorisation"
          style={{ width: "100%", maxWidth: 900, borderRadius: 16, border: "1px solid var(--border)" }}
        />
      </div>

      <Link
        href="/admin/login"
        style={{
          position: "fixed",
          bottom: 18,
          right: 22,
          zIndex: 10,
          fontSize: 11,
          color: "rgba(255,255,255,0.28)",
          textDecoration: "none",
          padding: "4px 8px",
        }}
      >
        admin
      </Link>
    </div>
  );
}
