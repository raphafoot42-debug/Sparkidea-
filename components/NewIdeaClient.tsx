"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewIdeaClient() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/ideas/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    router.push(`/dashboard?idea=${data.ideaId}`);
  }

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Nouveau projet</h1>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 22 }}>
        Décris ton idée en une ou deux phrases, l&apos;IA remplit le schéma.
      </p>

      <form onSubmit={handleSubmit} className="panel" style={{ padding: "22px 20px" }}>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          required
          minLength={6}
          maxLength={500}
          rows={4}
          className="field-input"
          placeholder="Ex : une appli qui aide les artisans à faire leurs devis en 2 minutes depuis le chantier."
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />

        {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: 16 }}>
          {loading ? "Analyse en cours..." : "Analyser →"}
        </button>
      </form>
    </div>
  );
}
