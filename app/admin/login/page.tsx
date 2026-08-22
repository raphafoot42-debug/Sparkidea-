"use client"; 

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; 
import { AnimatedGrid } from "@/components/AnimatedGrid";

export default function AdminLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Code incorrect.");
      return;
    }

    router.push("/admin");
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGrid intensity="discrete" />
      <form
        onSubmit={handleSubmit}
        className="panel"
        style={{ position: "relative", zIndex: 2, width: 300, padding: "28px 26px" }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Accès admin</h1>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>Entre ton code d&apos;accès</p>

        <input
          type="password"
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field-input"
          placeholder="Code"
          style={{ marginBottom: 16 }}
        />

        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={loading || code.length === 0} className="btn-primary" style={{ width: "100%" }}>
          {loading ? "..." : "Entrer"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Link href="/" style={{ fontSize: 12, color: "var(--muted)" }}>
            ← Revenir en arrière
          </Link>
        </div>
      </form>
    </div>
  );
}
