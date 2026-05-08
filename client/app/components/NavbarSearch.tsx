"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

type SearchProduct = {
  id: number;
  name: string;
  price: number;
  category: string;
  categoryName: string;
  image: string;
  imageCount?: number;
  unit?: string;
  ofpiActive?: number;
  offerPrice?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  primaryColor: string;
};

export default function NavbarSearch({ open, onClose, primaryColor }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened; reset state when closed.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setQuery("");
      setResults([]);
      setHasSearched(false);
    }
  }, [open]);

  // Lock background scroll while overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced fetch against the existing /api/search endpoint.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store' });
        const data = await res.json();
        if (data?.success) setResults(data.products || []);
        else setResults([]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setHasSearched(true);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    onClose();
    router.push(`/shop?q=${encodeURIComponent(trimmed)}`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Kerko makina"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Mbyll"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-3 sm:mx-4 mt-16 sm:mt-24 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search size={20} strokeWidth={2.5} className="text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kerko makina..."
            className="flex-1 bg-transparent outline-none text-base text-gray-900 placeholder-gray-400"
            autoComplete="off"
          />
          {loading && <Loader2 size={18} className="animate-spin text-gray-400 shrink-0" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Mbyll"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition shrink-0"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </form>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Shkruaj te pakten 2 shkronja per te kerkuar
            </div>
          ) : loading && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Duke kerkuar...</div>
          ) : hasSearched && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Asnje makine nuk u gjet per &quot;{query}&quot;
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((p) => {
                const hasOffer = !!p.ofpiActive && p.offerPrice != null && p.offerPrice > 0;
                const displayPrice = hasOffer ? Number(p.offerPrice) : Number(p.price);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/product/${p.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                    >
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                        {(p.imageCount ?? 0) > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/products/${p.id}/image`}
                            alt={p.name}
                            loading="lazy"
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="/logo-removed-background.png"
                            alt=""
                            aria-hidden="true"
                            className="w-3/4 h-3/4 object-contain opacity-40"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 truncate">{p.categoryName}</p>
                      </div>
                      <div className="text-sm font-bold shrink-0" style={{ color: primaryColor }}>
                        {displayPrice.toFixed(0)} L
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
