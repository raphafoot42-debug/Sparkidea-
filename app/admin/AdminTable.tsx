"use client";

import { useState } from "react";

type Row = {
  id: string;
  email: string;
  plan: string | null;
  subscriptionStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  ideasCount: number;
};

export function AdminTable({ users }: { users: Row[] }) {
  const [resetResult, setResetResult] = useState<{ userId: string; tempPassword: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleReset(userId: string) {
    setLoadingId(userId);
    setResetResult(null);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    setLoadingId(null);
    if (res.ok) {
      setResetResult({ userId, tempPassword: data.tempPassword });
    }
  }

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Email", "Forfait", "Statut", "Idées", "Inscrit le", "Dernière connexion", "Compte"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--muted)",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <Td>{u.email}</Td>
              <Td>{u.plan ?? "—"}</Td>
              <Td>
                <span style={{ color: u.subscriptionStatus === "ACTIVE" ? "var(--success)" : "#fca5a5" }}>
                  {u.subscriptionStatus === "ACTIVE" ? "Actif" : "Résilié"}
                </span>
              </Td>
              <Td>{u.ideasCount}</Td>
              <Td>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</Td>
              <Td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("fr-FR") : "Jamais"}</Td>
              <Td>
                {resetResult?.userId === u.id ? (
                  <span style={{ fontSize: 11.5, color: "var(--line)" }}>
                    Nouveau mdp : {resetResult.tempPassword}
                  </span>
                ) : (
                  <button
                    onClick={() => handleReset(u.id)}
                    disabled={loadingId === u.id}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 7,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    {loadingId === u.id ? "..." : "Réinitialiser mdp"}
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#cbd5e1" }}>
      {children}
    </td>
  );
}
