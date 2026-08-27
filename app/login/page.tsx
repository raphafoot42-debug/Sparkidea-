"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatedGrid } from "@/components/AnimatedGrid";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      setLoading(false);
      return;
    }

    router.push(data.isAdmin ? "/admin" : "/dashboard");
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGrid intensity="discrete" />
      <form
        onSubmit={handleSubmit}
        className="panel"
        style={{ position: "relative", zIndex: 2, width: 340, padding: "30px 26px" }}
      >
        <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14 }}>◆ Spark Idea</div>
        <h1 style={{ textAlign: "center", fontSize: 17, fontWeight: 600, margin: "12px 0 4px" }}>
          Connexion
        </h1>

        <div style={{ marginBottom: 13, marginTop: 20 }}>
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
        <div style={{ marginBottom: 13 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            placeholder="••••••••"
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: 8 }}>
          {loading ? "..." : "Se connecter"}
        </button>

        <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--muted)", marginTop: 12 }}>
          Mot de passe oublié ?{" "}
          <a href="tel:+33780112707" style={{ color: "var(--line)" }}>
            Contactez le responsable BRES
          </a>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a
            href="/"
            style={{
              fontSize: 12,
              color: "var(--muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              textDecoration: "none",
            }}
          >
            ← Revenir en arrière
          </a>
        </div>
      </form>
    </div>
  );
}
