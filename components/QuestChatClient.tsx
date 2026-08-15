"use client";

import { useRef, useState } from "react";

type Quest = { id: string; title: string; detail: string };
type Attachment = { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; previewUrl: string };
type Msg = { role: "user" | "assistant"; text: string; imagePreview?: string };

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function QuestChatClient({
  quests,
  initialQuestId,
  quota,
}: {
  quests: Quest[];
  initialQuestId?: string;
  quota: { used: number; limit: number };
}) {
  // Si on arrive depuis "Demander à l'IA" sur une quête précise, on la
  // présélectionne directement — sinon on retombe sur la première comme avant.
  const preselected = initialQuestId && quests.some((q) => q.id === initialQuestId) ? initialQuestId : quests[0]?.id ?? "";
  const [questId, setQuestId] = useState(preselected);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [attachWarning, setAttachWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeQuest = quests.find((q) => q.id === questId);

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAttachWarning(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      // Vidéos et autres fichiers : l'IA (Claude) ne "voit" que des images
      // pour l'instant — pas de compréhension vidéo native. On le dit
      // clairement plutôt que de laisser croire que ça marche.
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
    if ((!msg && !attachment) || busy || !questId) return;
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
        questId,
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

  if (quests.length === 0) {
    return (
      <div className="panel" style={{ padding: 20, textAlign: "center", maxWidth: 480, width: "100%" }}>
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
          Aucune quête en cours pour l&apos;instant — reviens ici si tu bloques sur une quête.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Aide IA</h1>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 6 }}>
        Pour quand une quête reste floue même après &quot;Voir plus&quot;. Quota séparé du chat sur le schéma.
      </p>
      <p style={{ fontSize: 11.5, color: quota.used >= quota.limit ? "var(--danger)" : "var(--muted)", marginBottom: 18 }}>
        {quota.used} / {quota.limit} messages utilisés ce mois-ci
      </p>

      <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
        Sur quelle quête tu bloques ?
      </label>
      <select
        value={questId}
        onChange={(e) => {
          setQuestId(e.target.value);
          setMessages([]);
        }}
        className="field-input"
        style={{ marginBottom: 16 }}
      >
        {quests.map((q) => (
          <option key={q.id} value={q.id}>
            {q.title}
          </option>
        ))}
      </select>

      <div className="panel" style={{ padding: 16, marginBottom: 14, minHeight: 160, maxHeight: 360, overflowY: "auto" }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Dis-moi ce qui bloque sur « {activeQuest?.title} » et je t&apos;explique autrement.
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
          placeholder={recording ? "Je t'écoute..." : "Explique ce qui bloque..."}
          style={{ flex: 1 }}
        />
        <button onClick={send} disabled={busy} className="btn-primary">
          {busy ? "..." : "Envoyer"}
        </button>
      </div>
    </div>
  );
}
