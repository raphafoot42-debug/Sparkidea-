"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  blocked: boolean;
  subscriptionStatus: string;
  email: string;
  theme: "dark" | "light"; 
  language: "fr" | "en" | "ja" | "ru";
};

const LANGUAGES: { value: "fr" | "en" | "ja" | "ru"; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ru", label: "Русский" },
];

export function SettingsClient({ blocked, subscriptionStatus, email, theme, language }: Props) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // --- Thème + langue ---
  const [currentTheme, setCurrentTheme] = useState(theme);
  const [currentLanguage, setCurrentLanguage] = useState(language);
  const [prefsLoading, setPrefsLoading] = useState(false);

  async function savePrefs(next: { theme?: "dark" | "light"; language?: "fr" | "en" | "ja" | "ru" }) {
    setPrefsLoading(true);
    if (next.theme) {
      setCurrentTheme(next.theme);
      document.documentElement.setAttribute("data-theme", next.theme);
    }
    if (next.language) setCurrentLanguage(next.language);
    await fetch("/api/account/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setPrefsLoading(false);
  }

  // --- Formulaire email / mot de passe ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState(email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountError(null);
    setAccountSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
      setAccountError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!currentPassword) {
      setAccountError("Entre ton mot de passe actuel pour confirmer.");
      return;
    }

    setAccountLoading(true);
    const res = await fetch("/api/account/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newEmail: newEmail !== email ? newEmail : undefined,
        newPassword: newPassword || undefined,
      }),
    });
    const data = await res.json();
    setAccountLoading(false);

    if (!res.ok) {
      setAccountError(data.error ?? "Une erreur est survenue.");
      return;
    }

    setAccountSuccess("Modifications enregistrées.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    router.refresh();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  async function handleCancel() {
    setCancelLoading(true);
    const res = await fetch("/api/stripe/cancel", { method: "POST" });
    setCancelLoading(false);
    if (res.ok) {
      router.push("/pricing");
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Paramètres</h1>

      {/* Apparence + langue */}
      <div className="panel" style={{ marginBottom: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>Apparence</div>

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Fond d&apos;écran</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => savePrefs({ theme: "dark" })}
            disabled={prefsLoading}
            className={currentTheme === "dark" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1 }}
          >
            Noir
          </button>
          <button
            type="button"
            onClick={() => savePrefs({ theme: "light" })}
            disabled={prefsLoading}
            className={currentTheme === "light" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1 }}
          >
            Blanc
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Langue</label>
        <select
          value={currentLanguage}
          onChange={(e) => savePrefs({ language: e.target.value as "fr" | "en" | "ja" | "ru" })}
          disabled={prefsLoading}
          className="field-input"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
          Ta préférence est enregistrée. La traduction complète de l&apos;interface dans les 3 autres langues n&apos;est
          pas encore faite — pour l&apos;instant seul le fond d&apos;écran change immédiatement.
        </p>
      </div>

      {blocked && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            padding: "16px 18px",
            border: "1px solid rgba(244,63,94,0.4)",
            background: "rgba(244,63,94,0.08)",
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fca5a5", marginBottom: 6 }}>
            Accès bloqué
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
            {subscriptionStatus === "CANCELED"
              ? "Ton abonnement a été résilié. Reprends un forfait pour retrouver ton dashboard, ton schéma et ton historique."
              : "Ton compte n'a pas encore de forfait actif. Choisis un forfait pour accéder à ton dashboard."}
          </p>
          <button className="btn-primary" onClick={() => router.push("/pricing")}>
            Voir les forfaits →
          </button>
        </div>
      )}

      {/* Email + mot de passe — vrai formulaire fonctionnel */}
      <form onSubmit={handleAccountSubmit} className="panel" style={{ marginBottom: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>Compte</div>

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Email</label>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="field-input"
          style={{ marginBottom: 14 }}
        />

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
          Nouveau mot de passe <span style={{ opacity: 0.6 }}>(laisser vide pour ne pas changer)</span>
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="field-input"
          placeholder="8 caractères minimum"
          style={{ marginBottom: 10 }}
        />
        {newPassword && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input"
            placeholder="Confirme le nouveau mot de passe"
            style={{ marginBottom: 10 }}
          />
        )}

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 8, marginBottom: 6 }}>
          Mot de passe actuel <span style={{ opacity: 0.6 }}>(requis pour confirmer)</span>
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="field-input"
          placeholder="Mot de passe actuel"
          style={{ marginBottom: 14 }}
        />

        {accountError && <div className="error-text" style={{ marginBottom: 10 }}>{accountError}</div>}
        {accountSuccess && (
          <div style={{ fontSize: 12.5, color: "#4ade80", marginBottom: 10 }}>{accountSuccess}</div>
        )}

        <button type="submit" disabled={accountLoading} className="btn-primary" style={{ width: "100%" }}>
          {accountLoading ? "..." : "Enregistrer"}
        </button>
      </form>

      {!blocked && (
        <div className="panel" style={{ marginBottom: 16, overflow: "hidden" }}>
          <Row label="Changer d&apos;abonnement" sub="Passer à un autre forfait" onClick={() => router.push("/pricing")} />
          {!confirmCancel ? (
            <Row
              label="Résilier l&apos;abonnement"
              sub="Accès bloqué immédiatement jusqu'à nouveau paiement"
              danger
              last
              onClick={() => setConfirmCancel(true)}
            />
          ) : (
            <div style={{ padding: "15px 18px" }}>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
                Confirme la résiliation : tu perdras l&apos;accès à l&apos;IA, à ton schéma et à ton historique
                jusqu&apos;à ce que tu repayes.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" onClick={() => setConfirmCancel(false)} style={{ flex: 1 }}>
                  Annuler
                </button>
                <button className="btn-danger" onClick={handleCancel} disabled={cancelLoading} style={{ flex: 1 }}>
                  {cancelLoading ? "..." : "Confirmer"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!blocked && (
        <div className="panel" style={{ marginBottom: 16, padding: "15px 18px" }}>
          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
            Envie de gagner de l&apos;argent gratuitement ? Contacte-moi.
          </div>
          <a href="https://t.me/Raphael42r" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent, #22d3ee)" }}>
            Nous contacter sur Telegram
          </a>
        </div>
      )}

      <div className="panel" style={{ overflow: "hidden" }}>
        <Row label="Déconnexion" onClick={handleLogout} last />
      </div>
    </div>
  );
}

function Row({
  label,
  sub,
  danger,
  last,
  onClick,
}: {
  label: string;
  sub?: string;
  danger?: boolean;
  last?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "15px 18px",
        borderBottom: last ? "none" : "1px solid var(--border)",
        fontSize: 13.5,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ color: danger ? "#fca5a5" : "var(--text)" }}>{label}</span>
        {sub && <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{sub}</span>}
      </div>
      {onClick && <span style={{ color: "var(--muted)" }}>›</span>}
    </div>
  );
}
