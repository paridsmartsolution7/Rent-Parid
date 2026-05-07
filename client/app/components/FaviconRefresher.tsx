"use client";

import { useEffect } from "react";

/**
 * Pins the favicon to /logo-removed-background.png so the tab always shows
 * the brand mark, even if Next's metadata renderer skipped the <link> tag.
 */
const FAVICON_HREF = '/favicon-large.png';

export default function FaviconRefresher() {
  useEffect(() => {
    document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((el) => {
      (el as HTMLLinkElement).href = FAVICON_HREF;
    });
    if (!document.querySelector('link[rel~="icon"]')) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = FAVICON_HREF;
      document.head.appendChild(link);
    }
  }, []);
  return null;
}
