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

      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "10vh 24px 14vh",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          Affiliation
        </div>
        <h2 style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 600, maxWidth: 560, lineHeight: 1.3 }}>
          Recommande Spark Idea. Sois payé pour ça.
        </h2>
        <p style={{ marginTop: 10, fontSize: 14, color: "var(--muted)", maxWidth: 460, lineHeight: 1.6 }}>
          Rejoins le programme gratuitement et touche une commission sur chaque personne que tu inscris — sans limite, sans avance de frais.
        </p>

        <div style={{ display: "flex", gap: 28, marginTop: 30, flexWrap: "wrap", justifyContent: "center", maxWidth: 640 }}>
          {[
            { n: 1, t: "Inscription", d: "Crée ton compte affilié en moins de deux minutes, aucune carte requise." },
            { n: 2, t: "Partage", d: "Récupère ton lien unique et diffuse-le où tu veux." },
            { n: 3, t: "Rémunération", d: "Chaque inscription via ton lien génère une commission versée automatiquement." },
          ].map((step) => (
            <div key={step.n} style={{ width: 170, textAlign: "center" }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  margin: "0 auto 10px",
                }}
              >
                {step.n}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{step.t}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{step.d}</div>
            </div>
          ))}
        </div>

        <a
          href="https://t.me/Raphael42r"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ marginTop: 30, textDecoration: "none", display: "inline-block" }}
        >
          Contactez-nous →
        </a>

        <div style={{ marginTop: 30, fontSize: 12.5, color: "var(--muted)" }}>
          Une question sur le programme ? Écris-moi sur Telegram{" "}
          <a href="https://t.me/Raphael42r" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)" }}>
            @Raphael42r
          </a>
        </div>
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
