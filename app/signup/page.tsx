"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatedGrid } from "@/components/AnimatedGrid";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/signup", {
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

    // Enchaîne vers l'écran "Ce qui va se passer" / avis clients, qui mène
    // ensuite lui-même aux forfaits — plus de saut direct inscription→forfaits.
    router.push("/welcome");
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGrid intensity="discrete" />
      <form
        onSubmit={handleSubmit}
        className="panel"
        style={{ position: "relative", zIndex: 2, width: 340, maxWidth: "90vw", padding: "30px 26px" }}
      >
        <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14 }}>◆ Spark Idea</div>
        <h1 style={{ textAlign: "center", fontSize: 17, fontWeight: 600, margin: "12px 0 4px" }}>
          Crée ton compte
        </h1>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginBottom: 22 }}>
          Pour sauvegarder ton idée et accéder à ton plan
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
        <div style={{ marginBottom: 13 }}>
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Mot de passe</label>
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

        {error && <div className="error-text">{error}</div>}

        <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: 8 }}>
          {loading ? "..." : "Continuer"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--muted)" }}>
            ← Revenir en arrière
          </Link>
        </div>
      </form>
    </div>
  );
}
