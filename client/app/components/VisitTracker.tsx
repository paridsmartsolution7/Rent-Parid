"use client";

import { useEffect } from "react";

/**
 * Fires once per page-load to record a visitor hit. The session_id stays in
 * localStorage so the same visitor is correlatable across reloads / pages
 * (lets the admin distinguish total page-views from unique visitors).
 */
function getOrCreateSessionId(): string {
  try {
    const KEY = "shop_visitor_id";
    let id: string | null = localStorage.getItem(KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      ).slice(0, 64);
      localStorage.setItem(KEY, id as string);
    }
    return id as string;
  } catch {
    return "anon";
  }
}

export default function VisitTracker() {
  useEffect(() => {
    try {
      fetch("/api/track/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: getOrCreateSessionId(),
          path: typeof window !== "undefined" ? window.location.pathname : null,
        }),
        keepalive: true,
      }).catch(() => {/* analytics is fire-and-forget */});
    } catch {/* swallow */}
  }, []);

  return null;
}
