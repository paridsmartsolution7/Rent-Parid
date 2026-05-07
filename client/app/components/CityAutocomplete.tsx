"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { cachedFetch } from "../lib/clientCache";

type City = { kodi: string | null; name: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

export default function CityAutocomplete({ value, onChange, placeholder, className, autoFocus }: Props) {
  const [cities, setCities] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    cachedFetch<{ success: boolean; cities: City[] }>('/api/cities')
      .then(d => {
        if (d.success) setCities(d.cities);
      })
      .catch(() => {});
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q
    ? cities.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50)
    : cities.slice(0, 50);

  // Keep the dropdown aligned to the input on scroll/resize while open
  useLayoutEffect(() => {
    if (!open || !inputRef.current) return;
    function place() {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // Close on outside click (both input and portal list count as "inside")
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (inputRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (filtered[highlight]) {
        e.preventDefault();
        pick(filtered[highlight].name);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const dropdown = open && coords ? (
    <div
      ref={listRef}
      style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto"
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-sm text-gray-500">
          Asnje qytet nuk u gjet. Vazhdoni te shkruani emrin tuaj.
        </div>
      ) : (
        filtered.map((c, i) => (
          <button
            key={`${c.kodi ?? c.name}-${i}`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(c.name)}
            onMouseEnter={() => setHighlight(i)}
            className={`w-full text-left px-3 py-2 text-sm transition ${
              i === highlight ? 'bg-blue-50 text-[#1F3E76]' : 'text-gray-800 hover:bg-gray-50'
            }`}
          >
            {c.name}
          </button>
        ))
      )}
    </div>
  ) : null;

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {mounted && dropdown && createPortal(dropdown, document.body)}
    </>
  );
}
