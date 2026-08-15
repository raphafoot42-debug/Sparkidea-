"use client";

import { useState } from "react";

export function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.replace("/admin/login");
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="btn-secondary"
      style={{ fontSize: 12 }}
    >
      {loading ? "..." : "Se déconnecter"}
    </button>
  );
}