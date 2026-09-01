"use client";

import { useRef, useState, useEffect } from "react";

type Attachment = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; previewUrl: string };
type Msg = { role: "user" | "assistant"; text: string; imagePreview?: string };

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [attachWarning, setAttachWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------
  // Fenêtre flottante déplaçable — position libre dans le dashboard.
  // ---------------------------------------------------------------------
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const CARD_WIDTH = 480;

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
    if (!dragging) return;
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
  }, [dragging]);

  function onHandlePointerDown(e: React.PointerEvent) {
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
      setAttachWarning("Seules les photos sont analysées par l'IA pour l'instant — vidéos et autres fichiers pas encore supportés.");
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

  function toggleVoice() {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setAttachWarning("La dictée vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    if (recording) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
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
    setAttachMenuOpen(false);
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
    setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
  }

  return (
    <div
      ref={cardRef}
      className="panel"
      style={{
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
      }}
    >
      <div
        onPointerDown={onHandlePointerDown}
        style={{
          padding: "10px 16px",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "grab",
          userSelect: "none",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          ⠿⠿ IA de {projectTitle}
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
              fontSize: 13,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {minimized ? "▢" : "–"}
          </button>
        </div>
      </div>

      {!minimized && <div style={{ padding: 20 }}>
        <div className="panel" style={{ padding: 16, marginBottom: 14, minHeight: 160, maxHeight: 300, overflowY: "auto" }}>
          {messages.length === 0 && (
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
            </div>
          ))}
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
              style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}
            >
              Retirer
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setAttachMenuOpen((v) => !v)}
              className="btn-secondary"
              aria-label="Joindre"
              style={{ padding: "0 12px", fontSize: 16 }}
            >
              +
            </button>
            {attachMenuOpen && (
              <div
                className="panel"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: 0,
                  zIndex: 10,
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 170,
                }}
              >
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setAttachMenuOpen(false);
                  }}
                  style={{ background: "transparent", border: "none", color: "var(--text)", textAlign: "left", padding: "8px 10px", fontSize: 13, cursor: "pointer" }}
                >
                  📷 Photo / capture d&apos;écran
                </button>
                <button
                  onClick={() => {
                    toggleVoice();
                    setAttachMenuOpen(false);
                  }}
                  style={{ background: "transparent", border: "none", color: "var(--text)", textAlign: "left", padding: "8px 10px", fontSize: 13, cursor: "pointer" }}
                >
                  🎤 Parler
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={onFileChosen} style={{ display: "none" }} />
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            className="field-input"
            placeholder={recording ? "Je t'écoute..." : "Pose ta question..."}
            style={{ flex: 1 }}
          />
          <button onClick={send} disabled={busy} className="btn-primary">
            {busy ? "..." : "Envoyer"}
          </button>
        </div>
      </div>}
    </div>
  );
}
