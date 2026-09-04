"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatedGrid } from "@/components/AnimatedGrid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGrid intensity="discrete" />
      <div className="panel" style={{ position: "relative", zIndex: 2, width: 340, maxWidth: "90vw", padding: "30px 26px" }}>
        <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14 }}>◆ Spark Idea</div>
        <h1 style={{ textAlign: "center", fontSize: 17, fontWeight: 600, margin: "12px 0 4px" }}>
          Nouveau mot de passe
        </h1>

        {!token ? (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
            Lien invalide.{" "}
            <a href="/forgot-password" style={{ color: "var(--line)" }}>
              Refais une demande.
            </a>
          </p>
        ) : done ? (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginTop: 20 }}>
            Mot de passe mis à jour. Redirection vers la connexion...
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="8 caractères minimum"
              />
            </div>
            <div style={{ marginBottom: 13 }}>
              <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Confirme-le</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field-input"
                placeholder="8 caractères minimum"
              />
            </div>

            {error && <div className="error-text">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: 8 }}>
              {loading ? "..." : "Valider"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
