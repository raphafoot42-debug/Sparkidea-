"use client";

import { useState } from "react";
import { AnimatedGrid } from "@/components/AnimatedGrid";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }
    // Toujours le même écran de succès, que le compte existe ou non — voir
    // la route API pour l'explication (éviter de révéler quels emails ont
    // un compte).
    setSent(true);
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGrid intensity="discrete" />
      <div className="panel" style={{ position: "relative", zIndex: 2, width: 340, maxWidth: "90vw", padding: "30px 26px" }}>
        <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14 }}>◆ Spark Idea</div>
        <h1 style={{ textAlign: "center", fontSize: 17, fontWeight: 600, margin: "12px 0 4px" }}>
          Mot de passe oublié
        </h1>

        {sent ? (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 20, lineHeight: 1.5 }}>
            Si un compte existe avec cet email, un lien de réinitialisation vient d&apos;être envoyé. Vérifie aussi tes spams.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", margin: "8px 0 20px" }}>
              On t&apos;envoie un lien pour en choisir un nouveau.
            </p>
            <div style={{ marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="toi@exemple.com"
              />
            </div>

            {error && <div className="error-text">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: 8 }}>
              {loading ? "..." : "Envoyer le lien"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/login" style={{ fontSize: 12, color: "var(--muted)" }}>
            ← Retour à la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
