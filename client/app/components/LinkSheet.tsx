"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";

/**
 * Bottom-sheet modal that slides up from below the viewport, renders an
 * external URL inside an <iframe> when allowed, or shows a "preview card"
 * fallback (title + host + Open-in-new-tab button) when the target site
 * refuses framing via X-Frame-Options / CSP frame-ancestors.
 *
 * Detection: after onload, we try to read `iframe.contentWindow.location.href`.
 *   - If a real foreign page loaded, this throws (cross-origin) → success.
 *   - If Chrome rendered its "refused to connect" placeholder, the location
 *     is same-origin or empty and reading it works → that's the refusal signal.
 *
 * Backdrop click + Esc close the sheet; body scroll is locked while open.
 */
export default function LinkSheet({
  url,
  title,
  open,
  onClose,
}: {
  url: string | null;
  title?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false); // keep DOM during fade-out
  const [animateIn, setAnimateIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [framingRefused, setFramingRefused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const refusedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLoaded(false);
      setFramingRefused(false);
      // next frame so the slide-in transition runs
      requestAnimationFrame(() => setAnimateIn(true));
      // Hard timeout — if nothing has reported in 4s the target is almost
      // certainly silently blocking. Surface the fallback regardless.
      refusedTimerRef.current = setTimeout(() => {
        setFramingRefused((prev) => prev || !loaded);
      }, 4000);
      return () => {
        if (refusedTimerRef.current) clearTimeout(refusedTimerRef.current);
      };
    }
    setAnimateIn(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll while the sheet is open
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Esc to close
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted || !url) return null;

  const host = (() => {
    try { return new URL(url).host; } catch { return url; }
  })();

  return (
    <div className="fixed inset-0 z-[200]" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <button
        aria-label="Mbyll"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${animateIn ? "opacity-100" : "opacity-0"}`}
      />

      {/* Sheet */}
      <div
        className={`absolute left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-200 ${animateIn ? "translate-y-0" : "translate-y-full"}`}
        style={{ height: "92vh", maxHeight: "92vh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            {title ? (
              <p className="font-semibold text-gray-900 text-sm truncate">{title}</p>
            ) : null}
            <p className="text-xs text-gray-500 truncate">{host}</p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition"
            aria-label="Hap ne tab te ri"
            title="Hap ne tab te ri"
          >
            <ExternalLink size={18} />
          </a>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 p-2 rounded-full hover:bg-gray-100 transition"
            aria-label="Mbyll"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 bg-gray-50 overflow-hidden">
          {!loaded && !framingRefused && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Duke ngarkuar…
            </div>
          )}
          {framingRefused && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <ExternalLink size={22} className="text-amber-700" />
                </div>
                {title ? (
                  <p className="font-bold text-gray-900 text-lg mb-1 break-words">{title}</p>
                ) : null}
                <p className="text-sm text-gray-500 mb-4 break-all">{host}</p>
                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                  Kjo faqe nuk lejon shfaqjen brenda dyqanit. Mund ta hapesh direkt — do te hapet ne nje tab te ri pa larguar nga blogu.
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold"
                >
                  <ExternalLink size={16} /> Hap ne tab te ri
                </a>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={url}
            title={title || host}
            className={`w-full h-full bg-white ${framingRefused ? "hidden" : ""}`}
            referrerPolicy="no-referrer"
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            onLoad={() => {
              setLoaded(true);
              // Detection: if we can read the iframe's location, the browser
              // rendered its own "refused to connect" placeholder (same-origin
              // or about:blank). A real foreign page would throw here due to
              // the same-origin policy.
              try {
                const inner = iframeRef.current?.contentWindow?.location?.href;
                if (inner === undefined || inner === "" || inner === "about:blank" || inner === url) {
                  // about:blank or echo of our own src means the target
                  // never actually loaded its document into the frame.
                  setFramingRefused(inner !== url || !iframeRef.current?.contentDocument?.body?.children.length);
                  return;
                }
                // Reading succeeded with a non-blank URL → likely a chrome
                // error page. Surface the fallback.
                setFramingRefused(true);
              } catch {
                // Cross-origin throw = real foreign page rendered. Success.
                setFramingRefused(false);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
