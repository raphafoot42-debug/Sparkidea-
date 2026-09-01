"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSettingsDict } from "@/lib/i18n";

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
  const t = getSettingsDict(currentLanguage);

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
      setAccountError(t.passwordMismatch);
      return;
    }
    if (!currentPassword) {
      setAccountError(t.currentPasswordRequired);
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
      setAccountError(data.error ?? t.genericError);
      return;
    }

    setAccountSuccess(t.accountSaved);
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
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>{t.title}</h1>

      {/* Apparence + langue */}
      <div className="panel" style={{ marginBottom: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{t.appearance}</div>

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{t.wallpaper}</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => savePrefs({ theme: "dark" })}
            disabled={prefsLoading}
            className={currentTheme === "dark" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1 }}
          >
            {t.dark}
          </button>
          <button
            type="button"
            onClick={() => savePrefs({ theme: "light" })}
            disabled={prefsLoading}
            className={currentTheme === "light" ? "btn-primary" : "btn-secondary"}
            style={{ flex: 1 }}
          >
            {t.light}
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{t.language}</label>
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
          {t.langNote}
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
            {t.blockedTitle}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
            {subscriptionStatus === "CANCELED" ? t.blockedCanceled : t.blockedNoPlan}
          </p>
          <button className="btn-primary" onClick={() => router.push("/pricing")}>
            {t.viewPlans}
          </button>
        </div>
      )}

      {/* Email + mot de passe — vrai formulaire fonctionnel */}
      <form onSubmit={handleAccountSubmit} className="panel" style={{ marginBottom: 16, padding: "18px 20px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{t.account}</div>

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{t.email}</label>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="field-input"
          style={{ marginBottom: 14 }}
        />

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
          {t.newPasswordLabel} <span style={{ opacity: 0.6 }}>{t.newPasswordHint}</span>
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="field-input"
          placeholder={t.newPasswordPlaceholder}
          style={{ marginBottom: 10 }}
        />
        {newPassword && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input"
            placeholder={t.confirmPasswordPlaceholder}
            style={{ marginBottom: 10 }}
          />
        )}

        <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 8, marginBottom: 6 }}>
          {t.currentPasswordLabel} <span style={{ opacity: 0.6 }}>{t.currentPasswordHint}</span>
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="field-input"
          placeholder={t.currentPasswordPlaceholder}
          style={{ marginBottom: 14 }}
        />

        {accountError && <div className="error-text" style={{ marginBottom: 10 }}>{accountError}</div>}
        {accountSuccess && (
          <div style={{ fontSize: 12.5, color: "#4ade80", marginBottom: 10 }}>{accountSuccess}</div>
        )}

        <button type="submit" disabled={accountLoading} className="btn-primary" style={{ width: "100%" }}>
          {accountLoading ? t.saving : t.save}
        </button>
      </form>

      {!blocked && (
        <div className="panel" style={{ marginBottom: 16, overflow: "hidden" }}>
          <Row label={t.changePlan} sub={t.changePlanSub} onClick={() => router.push("/pricing")} />
          {!confirmCancel ? (
            <Row
              label={t.cancelPlan}
              sub={t.cancelPlanSub}
              danger
              last
              onClick={() => setConfirmCancel(true)}
            />
          ) : (
            <div style={{ padding: "15px 18px" }}>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
                {t.cancelConfirmText}
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-secondary" onClick={() => setConfirmCancel(false)} style={{ flex: 1 }}>
                  {t.cancel}
                </button>
                <button className="btn-danger" onClick={handleCancel} disabled={cancelLoading} style={{ flex: 1 }}>
                  {cancelLoading ? t.confirming : t.confirm}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!blocked && (
        <div className="panel" style={{ marginBottom: 16, padding: "15px 18px" }}>
          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 4 }}>
            {t.telegramTeaser}
          </div>
          <a href="https://t.me/Raphael42r" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent, #22d3ee)" }}>
            {t.telegramLink}
          </a>
        </div>
      )}

      <div className="panel" style={{ overflow: "hidden" }}>
        <Row label={t.logout} onClick={handleLogout} last />
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
