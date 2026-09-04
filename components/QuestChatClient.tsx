"use client";

import { useRef, useState, useEffect } from "react";

type Attachment = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; previewUrl: string };
type Msg = { role: "user" | "assistant"; text: string; imagePreview?: string };

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ---------------------------------------------------------------------------
// Icônes — le strict minimum fonctionnel (joindre / micro / envoyer / fermer),
// traits fins, monochrome, sans décoration. Pas de menu, pas d'icône pour
// des choses qui n'en ont pas besoin (le bandeau du haut se glisse tout seul,
// pas besoin d'une icône de poignée dessus).
// ---------------------------------------------------------------------------
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.5 10V3.5a1 1 0 0 1 1-1H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8m0 0 3-3m-3 3-3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Repère un bloc de code ``` ... ``` dans une réponse de l'IA et le
// sépare du reste du texte — pour l'afficher dans le panneau externe
// plutôt que noyé dans la bulle de discussion.
function extractCodeBlock(text: string): { prose: string; language: string; code: string } | null {
  const match = text.match(/```(\w*)\n([\s\S]*?)```/);
  if (!match) return null;
  const [full, language, code] = match;
  const prose = text.replace(full, "").trim();
  return { prose, language: language || "text", code: code.trim() };
}

const EXTENSION_BY_LANGUAGE: Record<string, string> = {
  javascript: "js", typescript: "ts", tsx: "tsx", jsx: "jsx", python: "py",
  html: "html", css: "css", json: "json", bash: "sh", sql: "sql", text: "txt",
};

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d={direction === "up" ? "M3 8.5 6.5 5 10 8.5" : "M3 4.5 6.5 8 10 4.5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.2 8.2a4.8 4.8 0 0 0 9.6 0M8 13v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 8.4 13.5 3l-4 11-2.2-4.6L2 8.4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Bulle "l'IA réfléchit" — trois points qui pulsent, dans une bulle assistant
// normale, à gauche comme le reste des réponses. Remplace le simple "..."
// sur le bouton, qui ne se voyait pas dans la conversation elle-même.
function ThinkingBubble() {
  return (
    <div style={{ marginBottom: 10, textAlign: "left" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--surface-subtle)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--muted)",
              animation: `spark-think 1.1s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </span>
      <style>{`
        @keyframes spark-think {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}

export function QuestChatClient({
  ideaId,
  projectTitle,
  quota,
}: {
  ideaId: string;
  projectTitle: string;
  quota: { used: number; limit: number };
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [recording, setRecording] = useState(false);
  const [attachWarning, setAttachWarning] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<{ language: string; code: string } | null>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [artifactCopied, setArtifactCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // ---------------------------------------------------------------------
  // Fenêtre flottante déplaçable — position libre dans le dashboard.
  // ---------------------------------------------------------------------
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const CARD_WIDTH = 480;

  // Sur mobile/tablette (écran étroit), la fenêtre flottante librement
  // déplaçable est difficile à manier — on bascule sur un panneau ancré en
  // bas de l'écran, pleine largeur, sans glisser-déposer. Décidé avec
  // Raphaël : le flottant reste sur desktop, mais doit être "maniable"
  // partout, pas juste joli.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 720);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Empêche la fenêtre de sortir de l'écran (impossible à rattraper sinon).
  function clamp(x: number, y: number) {
    const w = Math.min(CARD_WIDTH, window.innerWidth - 32);
    const h = minimized ? 48 : 40; // hauteur mini de la barre visible à garder à l'écran
    return {
      x: Math.min(Math.max(x, 8), window.innerWidth - w - 8),
      y: Math.min(Math.max(y, 8), window.innerHeight - h - 8),
    };
  }

  useEffect(() => {
    setPos(clamp(window.innerWidth - CARD_WIDTH - 60, window.innerHeight / 2 - 220));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dragging || isMobile) return;
    function onMove(e: PointerEvent) {
      setPos(clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y));
    }
    function onUp() {
      setDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, isMobile]);

  function onHandlePointerDown(e: React.PointerEvent) {
    if (isMobile) return; // pas de glisser-déposer sur mobile, ancré en bas
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachWarning(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setAttachWarning("Seules les photos sont analysées par l'IA pour l'instant.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setAttachment({ base64, mediaType: file.type as Attachment["mediaType"], previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  }

  // Micro à bascule, façon Gemini/Claude : un appui démarre l'écoute, un
  // second appui sur le MÊME bouton l'arrête explicitement (au lieu de
  // dépendre uniquement du silence détecté par le navigateur). Le texte
  // reconnu atterrit dans le champ, prêt à être complété ou envoyé.
  function toggleVoice() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setAttachWarning("La dictée vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (e: any) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    setRecording(true);
    recognition.start();
  }

  async function send() {
    const msg = input.trim();
    if ((!msg && !attachment) || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const sentAttachment = attachment;
    setAttachment(null);
    setMessages((m) => [...m, { role: "user", text: msg || "(photo jointe)", imagePreview: sentAttachment?.previewUrl }]);

    const res = await fetch("/api/quests/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ideaId,
        message: msg || "Regarde cette image et aide-moi.",
        image: sentAttachment ? { base64: sentAttachment.base64, mediaType: sentAttachment.mediaType } : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Erreur.");
      return;
    }
    const extracted = extractCodeBlock(data.reply);
    if (extracted) {
      setArtifact({ language: extracted.language, code: extracted.code });
      setMessages((m) => [...m, { role: "assistant", text: extracted.prose || "Voilà, c'est dans le panneau à côté →" }]);
    } else {
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    }
  }

  const canSend = !busy && (input.trim().length > 0 || !!attachment);

  return (
    <>
    <div
      ref={cardRef}
      className="panel"
      style={
        isMobile
          ? {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              maxWidth: "100%",
              zIndex: 20,
              padding: 0,
              borderRadius: "16px 16px 0 0",
              boxShadow: "0 -8px 30px rgba(0,0,0,0.5)",
              maxHeight: minimized ? undefined : "75vh",
              display: "flex",
              flexDirection: "column",
            }
          : {
              position: "fixed",
              left: pos.x,
              top: pos.y,
              width: CARD_WIDTH,
              maxWidth: "calc(100vw - 32px)",
              zIndex: 20,
              padding: 0,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              cursor: dragging ? "grabbing" : "default",
              userSelect: dragging ? "none" : "auto",
            }
      }
    >
      <div
        onPointerDown={onHandlePointerDown}
        style={{
          padding: "10px 14px",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: isMobile ? "default" : "grab",
          userSelect: "none",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          IA · {projectTitle}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "var(--muted)" }}>
            {quota.used} / {quota.limit}
          </span>
          <button
            onClick={() => setMinimized((v) => !v)}
            aria-label={minimized ? "Agrandir" : "Réduire"}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              color: "var(--muted)",
              width: 22,
              height: 22,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronIcon direction={minimized ? "up" : "down"} />
          </button>
        </div>
      </div>

      {!minimized && <div style={{ padding: 20 }}>
        <div className="panel" style={{ padding: 16, marginBottom: 14, minHeight: 160, maxHeight: 300, overflowY: "auto" }}>
          {messages.length === 0 && !busy && (
            <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Pose n&apos;importe quelle question sur ton projet — je connais déjà ton schéma et tes quêtes en cours.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: 10,
                textAlign: m.role === "user" ? "right" : "left",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  maxWidth: "85%",
                  background: m.role === "user" ? "rgba(34,211,238,0.15)" : "var(--surface-subtle)",
                }}
              >
                {m.imagePreview && (
                  <img
                    src={m.imagePreview}
                    alt="Pièce jointe"
                    style={{ maxWidth: "100%", borderRadius: 8, marginBottom: m.text ? 6 : 0, display: "block" }}
                  />
                )}
                {m.text}
              </span>
              {m.role === "assistant" && m.text && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(m.text);
                    setCopiedMessageIndex(i);
                    setTimeout(() => setCopiedMessageIndex((cur) => (cur === i ? null : cur)), 1500);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 3,
                    background: "transparent",
                    border: "none",
                    color: "var(--muted)",
                    fontSize: 10.5,
                    cursor: "pointer",
                    padding: "2px 0",
                  }}
                >
                  <CopyIcon /> {copiedMessageIndex === i ? "Copié" : "Copier"}
                </button>
              )}
            </div>
          ))}
          {busy && <ThinkingBubble />}
        </div>

        {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
        {attachWarning && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{attachWarning}</div>
        )}

        {attachment && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <img src={attachment.previewUrl} alt="Aperçu" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Photo prête à envoyer</span>
            <button
              onClick={() => setAttachment(null)}
              aria-label="Retirer la pièce jointe"
              style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
            >
              <CloseIcon /> Retirer
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            aria-label="Joindre une photo"
            style={{ width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <PlusIcon />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChosen} style={{ display: "none" }} />

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              // Entrée envoie, Maj+Entrée passe à la ligne — comme Claude,
              // pour pouvoir écrire un vrai paragraphe sans envoyer à
              // chaque retour à la ligne.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) send();
              }
            }}
            rows={1}
            className="field-input"
            placeholder={recording ? "Je t'écoute..." : "Pose ta question..."}
            style={{ flex: 1, resize: "none", lineHeight: 1.4, paddingTop: 8, paddingBottom: 8, maxHeight: 120, overflowY: "auto" }}
          />

          <button
            onClick={toggleVoice}
            aria-label={recording ? "Arrêter l'enregistrement" : "Dicter un message"}
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "50%",
              border: recording ? "1px solid var(--danger)" : "1px solid var(--border)",
              background: recording ? "rgba(244,63,94,0.12)" : "transparent",
              color: recording ? "var(--danger)" : "var(--muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {recording && (
              <span
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: "50%",
                  border: "1px solid var(--danger)",
                  animation: "spark-pulse 1.4s infinite ease-out",
                }}
              />
            )}
            {recording ? <StopIcon /> : <MicIcon />}
          </button>

          <button
            onClick={send}
            disabled={!canSend}
            aria-label="Envoyer"
            className="btn-primary"
            style={{ width: 34, height: 34, padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <SendIcon />
          </button>
        </div>
      </div>}
      <style>{`
        @keyframes spark-pulse {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.35); }
        }
      `}</style>
    </div>

    {/* Panneau externe — reste ouvert à côté de la fenêtre de chat quand
        l'IA génère du code, comme les "artifacts" de Claude. Sur mobile,
        pas assez de place à côté : il s'affiche empilé sous le chat. */}
    {artifact && !minimized && (
      <div
        className="panel"
        style={
          isMobile
            ? { position: "fixed", left: 12, right: 12, bottom: "78vh", maxHeight: "20vh", zIndex: 21, padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }
            : { position: "fixed", left: Math.max(12, pos.x - 340), top: pos.y, width: 320, maxHeight: 420, zIndex: 21, padding: 0, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }
        }
      >
        <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>{artifact.language}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(artifact.code);
                setArtifactCopied(true);
                setTimeout(() => setArtifactCopied(false), 1500);
              }}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}
            >
              <CopyIcon /> {artifactCopied ? "Copié" : "Copier"}
            </button>
            <button
              onClick={() => {
                const ext = EXTENSION_BY_LANGUAGE[artifact.language] || "txt";
                const blob = new Blob([artifact.code], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `spark-idea.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}
            >
              <DownloadIcon /> Télécharger
            </button>
            <button
              onClick={() => setArtifact(null)}
              aria-label="Fermer le panneau"
              style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <pre style={{ margin: 0, padding: 12, fontSize: 12, lineHeight: 1.5, overflow: "auto", fontFamily: "ui-monospace, monospace" }}>
          <code>{artifact.code}</code>
        </pre>
      </div>
    )}
    </>
  );
}
