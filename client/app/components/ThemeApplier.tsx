"use client";

import { useEffect } from "react";

/**
 * Reads /api/config and exposes brand colors as CSS variables on :root so any
 * component can use var(--primary-color) etc. Polls every 30s so admin changes
 * propagate without a hard refresh — cheap because /api/config GET is fast and
 * cached by the shop's clientCache.
 */
export default function ThemeApplier() {
  useEffect(() => {
    let cancelled = false;
    const apply = (cfg: any) => {
      if (!cfg) return;
      const root = document.documentElement;
      if (cfg.primary_color) root.style.setProperty('--primary-color', cfg.primary_color);
      if (cfg.secondary_color) root.style.setProperty('--secondary-color', cfg.secondary_color);
      if (cfg.navbar_color) root.style.setProperty('--navbar-color', cfg.navbar_color);
    };

    const fetchOnce = async () => {
      try {
        const r = await fetch('/api/config', { cache: 'no-store' });
        const d = await r.json();
        if (!cancelled && d?.success) apply(d.config);
      } catch {/* silent */}
    };

    fetchOnce();
    const interval = setInterval(fetchOnce, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
