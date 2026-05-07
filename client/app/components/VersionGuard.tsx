"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "app_build_version";

// Polls /api/version to detect when a new build has been deployed. On change,
// clears in-app caches (sessionStorage, used by lib/clientCache) and triggers
// a hard reload so every visitor lands on the latest assets.
export default function VersionGuard() {
  const reloadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (reloadingRef.current) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const incoming = data?.version ? String(data.version) : "";
        if (!incoming || cancelled) return;

        let stored: string | null = null;
        try {
          stored = localStorage.getItem(STORAGE_KEY);
        } catch {
          return; // localStorage unavailable — bail.
        }

        if (!stored) {
          try {
            localStorage.setItem(STORAGE_KEY, incoming);
          } catch {}
          return;
        }

        if (stored !== incoming) {
          reloadingRef.current = true;
          try {
            localStorage.setItem(STORAGE_KEY, incoming);
            sessionStorage.clear();
          } catch {}
          window.location.reload();
        }
      } catch {
        // Network/parse failure — silently ignore; we'll try again next tick.
      }
    }

    check();

    function onVisible() {
      if (document.visibilityState === "visible") check();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    // Periodic poll for users who keep the tab open for hours.
    const interval = window.setInterval(check, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
