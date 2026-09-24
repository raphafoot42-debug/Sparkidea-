"use client";

import { useEffect } from "react";

export function AffitorTracker() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const clickId =
        params.get("affitor_click_id") ||
        params.get("click_id") ||
        params.get("clickid") ||
        params.get("ref") ||
        params.get("via") ||
        params.get("aff");

      if (clickId) {
        const expires = new Date();
        expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
        document.cookie = `affitor_click_id=${encodeURIComponent(
          clickId
        )};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      }
    } catch {
      // Ignorer silencieusement si inaccessible (SSR, restrictions navigateur, etc.)
    }
  }, []);

  return null;
}
