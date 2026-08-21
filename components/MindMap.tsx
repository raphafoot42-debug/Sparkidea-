"use client";

import { useEffect, useRef, useState } from "react";
import type { SchemaResult } from "@/lib/ai/schema-generator";

type Props = {
  schema: SchemaResult;
  onSchemaChange?: (schema: SchemaResult) => void;
  // Si présent : chat authentifié, isolé sur CE projet précis (isolation 
  // stricte gérée côté serveur dans /api/chat).
  ideaId?: string;
  // Sinon : chat gratuit, sans sauvegarde.
  freeMode?: boolean;
  onVoirPlus?: () => void;
};

type NodePos = { id: string; x: number; y: number; w: number; h: number };

// Dispose les points autour du centre en cercle, avec un peu de variation
// pour ne pas avoir un rendu trop mécanique.
function layoutNodes(schema: SchemaResult): NodePos[] {
  const positions: NodePos[] = [
    { id: "center", x: 0, y: 0, w: 140, h: 140 },
  ];
  const count = schema.nodes.length;
  schema.nodes.forEach((n, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const radius = 260;
    positions.push({
      id: n.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      w: n.type === "risk" ? 160 : 130,
      h: n.type === "risk" ? 95 : 120,
    });
  });
  return positions;
}

export function MindMap({ schema, onSchemaChange, ideaId, freeMode, onVoirPlus }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<NodePos[]>(() => layoutNodes(schema));
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [aiText, setAiText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Verrou de l'essai gratuit (avant compte) : les questions de clarification
  // ont déjà eu lieu AVANT le schéma (voir app/page.tsx + askClarifyingQuestion).
  // Une fois le schéma affiché, le chat est complètement verrouillé — seul
  // "Voir plus" reste possible, comme décidé avec Raphaël.
  const FREE_CHAT_LIMIT = 0;
  const [freeMessageCount, setFreeMessageCount] = useState(0);
  const freeChatLocked = freeMode && freeMessageCount >= FREE_CHAT_LIMIT;
  // Panneau "Voir plus" : détail d'un nœud précis, ouvert sur la même page
  // (pas de changement de route), refermé pour revenir au schéma propre.
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // FIX : window n'existe pas côté serveur. Next.js rend les composants
  // "use client" une première fois côté serveur pour le HTML initial, donc
  // toute lecture directe de window.innerWidth/innerHeight dans le JSX
  // (au lieu d'un useEffect) provoque un crash SSR ("window is not defined").
  // On stocke la taille de la fenêtre en state, initialisée à 0 côté serveur
  // et mise à jour après le montage côté client.
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    function updateViewport() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const dragState = useRef<{ type: "pan" | "node"; id?: string; lastX: number; lastY: number } | null>(null);

  // Reconstruit les positions si le schéma change (nouveau nœud ajouté par le chat).
  useEffect(() => {
    setPositions(layoutNodes(schema));
  }, [schema.nodes.length]);

  // Construction progressive à l'ouverture, comme validé.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setShownIds(new Set(["center"]));
      await typeText(`J'analyse ${schema.projectTitle}. On commence par le cœur du projet.`, cancelled);
      for (const n of schema.nodes) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 400));
        setShownIds((prev) => new Set(prev).add(n.id));
        await typeText(n.comment, cancelled);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.projectTitle]);

  async function typeText(str: string, cancelled: boolean) {
    setAiText("");
    for (let i = 0; i <= str.length; i += 3) {
      if (cancelled) return;
      setAiText(str.slice(0, i));
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // --- Pan / drag (souris + tactile via Pointer Events) ---
  function onPointerDownBg(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    dragState.current = { type: "pan", lastX: e.clientX, lastY: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerDownNode(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    dragState.current = { type: "node", id, lastX: e.clientX, lastY: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const st = dragState.current;
    if (!st) return;
    const dx = e.clientX - st.lastX;
    const dy = e.clientY - st.lastY;
    dragState.current = { ...st, lastX: e.clientX, lastY: e.clientY };

    if (st.type === "pan") {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else if (st.type === "node" && st.id) {
      setPositions((prev) =>
        prev.map((p) => (p.id === st.id ? { ...p, x: p.x + dx / scale, y: p.y + dy / scale } : p))
      );
    }
  }
  function onPointerUp() {
    dragState.current = null;
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => Math.min(2, Math.max(0.4, s + (e.deltaY > 0 ? -0.08 : 0.08))));
  }

  // --- Chat ---
  async function sendMessage() {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    if (freeChatLocked) {
      setChatError("Ton schéma est prêt. Crée ton compte pour continuer la conversation et le suivi de ton projet.");
      return;
    }
    setChatBusy(true);
    setChatError(null);
    setChatInput("");

    try {
      if (freeMode) {
        const res = await fetch("/api/chat-free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema, message: msg }),
        });
        const data = await res.json();
        if (!res.ok) {
          setChatError(data.error ?? "Erreur.");
        } else {
          setFreeMessageCount((n) => n + 1);
          if (data.newNode && onSchemaChange) {
            onSchemaChange({ ...schema, nodes: [...schema.nodes, data.newNode] });
          }
        }
      } else if (ideaId) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ideaId, message: msg }),
        });
        const data = await res.json();
        if (!res.ok) {
          setChatError(data.error ?? "Erreur.");
        } else if (onSchemaChange) {
          onSchemaChange(data.schema);
        }
      }
    } finally {
      setChatBusy(false);
    }
  }

  const centerPos = positions.find((p) => p.id === "center")!;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden" }}>
      <div
        ref={wrapRef}
        onPointerDown={onPointerDownBg}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none" }}
      >
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id="gradOk" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="gradRisk" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          {viewport.w > 0 && schema.nodes.map((n) => {
            if (!shownIds.has(n.id)) return null;
            const pos = positions.find((p) => p.id === n.id);
            if (!pos) return null;
            const cx = viewport.w / 2 + pan.x + centerPos.x * scale;
            const cy = viewport.h / 2 + pan.y + centerPos.y * scale;
            const nx = viewport.w / 2 + pan.x + pos.x * scale;
            const ny = viewport.h / 2 + pan.y + pos.y * scale;
            return (
              <line
                key={n.id}
                x1={cx}
                y1={cy}
                x2={nx}
                y2={ny}
                stroke={n.type === "risk" ? "url(#gradRisk)" : "url(#gradOk)"}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        <div
          ref={mapRef}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%,-50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          <div
            data-node
            style={{
              position: "absolute",
              left: centerPos.x,
              top: centerPos.y,
              transform: `translate(-50%,-50%) scale(${shownIds.has("center") ? 1 : 0})`,
              transition: "transform 0.45s cubic-bezier(.34,1.56,.64,1)",
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #22d3ee, #a855f7)",
              color: "#05070a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontWeight: 700,
              fontSize: 14,
              padding: 16,
              cursor: "grab",
              boxShadow: "0 0 40px rgba(34,211,238,0.3)",
            }}
            onPointerDown={(e) => onPointerDownNode(e, "center")}
          >
            {schema.projectTitle}
          </div>

          {schema.nodes.map((n) => {
            const pos = positions.find((p) => p.id === n.id);
            if (!pos) return null;
            const shown = shownIds.has(n.id);
            const baseStyle: React.CSSProperties = {
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: `translate(-50%,-50%) scale(${shown ? 1 : 0})`,
              opacity: shown ? 1 : 0,
              transition: "transform 0.45s cubic-bezier(.34,1.56,.64,1)",
              maxWidth: 160,
              fontSize: 12,
              lineHeight: 1.4,
              padding: "13px 17px",
              borderRadius: 16,
              cursor: "grab",
              border: "1.5px solid transparent",
            };
            if (n.type === "todo") {
              Object.assign(baseStyle, {
                background: "linear-gradient(135deg, rgba(34,211,238,0.28), rgba(34,211,238,0.06))",
                borderColor: "rgba(34,211,238,0.55)",
                color: "#ecfeff",
              });
            } else if (n.type === "risk") {
              Object.assign(baseStyle, {
                background: "linear-gradient(135deg, rgba(244,63,94,0.28), rgba(244,63,94,0.06))",
                borderColor: "rgba(244,63,94,0.55)",
                color: "#fff1f2",
                clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
                padding: "28px 16px 10px",
                textAlign: "center",
              });
            } else {
              Object.assign(baseStyle, {
                background: "linear-gradient(135deg, rgba(168,85,247,0.28), rgba(168,85,247,0.06))",
                borderColor: "rgba(168,85,247,0.55)",
                color: "#faf5ff",
                borderRadius: "50%",
                width: 130,
                height: 130,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              });
            }
            return (
              <div key={n.id} data-node style={baseStyle} onPointerDown={(e) => onPointerDownNode(e, n.id)}>
                <i
                  aria-hidden="true"
                  className={
                    n.type === "risk"
                      ? "ti ti-alert-triangle"
                      : n.type === "win"
                        ? "ti ti-sparkles"
                        : "ti ti-arrow-big-right-lines"
                  }
                  style={{
                    display: "block",
                    fontSize: 16,
                    marginBottom: 6,
                    color: n.type === "risk" ? "#fda4af" : n.type === "win" ? "#d8b4fe" : "#67e8f9",
                  }}
                />
                <div>{n.label}</div>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedNodeId(n.id);
                  }}
                  style={{
                    marginTop: 6,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    font: "inherit",
                    fontSize: 10.5,
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: "inherit",
                    opacity: 0.75,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  Voir plus →
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panneau IA en direct */}
      <div
        className="panel"
        style={{ position: "fixed", top: 16, right: 16, zIndex: 15, width: 280, padding: 14 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 8 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--line)",
              boxShadow: "0 0 8px var(--line)",
            }}
          />
          Analyse en direct
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#e2e8f0", maxHeight: 140, overflowY: "auto" }}>
          {aiText}
        </div>
      </div>

      {/* Barre de chat */}
      <div
        className="panel"
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 15,
          width: "min(560px, 70vw)",
          padding: 6,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={freeChatLocked}
          placeholder={freeChatLocked ? "Crée ton compte pour continuer →" : "Parle à l'IA de ton projet..."}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: freeChatLocked ? "var(--muted)" : "var(--text)",
            fontSize: 13,
            paddingLeft: 10,
          }}
        />
        <button onClick={sendMessage} disabled={chatBusy || freeChatLocked} className="btn-secondary" style={{ borderRadius: 11 }}>
          {chatBusy ? "..." : "→"}
        </button>
        {freeMode && onVoirPlus && (
          <button
            onClick={onVoirPlus}
            className="btn-primary"
            style={{
              whiteSpace: "nowrap",
              boxShadow: freeChatLocked ? "0 0 0 2px rgba(34,211,238,0.5)" : undefined,
            }}
          >
            Voir plus →
          </button>
        )}
      </div>

      {chatError && (
        <div
          className="error-text"
          style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", zIndex: 15 }}
        >
          {chatError}
        </div>
      )}

      {/* Panneau "Voir plus" — reste sur la même page, ne navigue jamais ailleurs */}
      {expandedNodeId && (() => {
        const n = schema.nodes.find((node) => node.id === expandedNodeId);
        if (!n) return null;
        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "var(--overlay)",
              backdropFilter: "blur(6px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              overflowY: "auto",
              padding: "24px 20px 60px",
            }}
          >
            <div style={{ width: "100%", maxWidth: 640 }}>
              <button
                onClick={() => setExpandedNodeId(null)}
                className="btn-secondary"
                style={{ marginBottom: 22 }}
              >
                ← Retour au schéma
              </button>

              <div
                style={{
                  display: "inline-block",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                {n.type === "todo" ? "À faire" : n.type === "risk" ? "Point de vigilance" : "Opportunité"}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 18, lineHeight: 1.3 }}>
                {n.label}
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#e2e8f0", whiteSpace: "pre-line" }}>
                {n.detail || n.comment}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
