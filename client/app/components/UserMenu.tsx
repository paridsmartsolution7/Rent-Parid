"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { User, ChevronDown, LogOut } from "lucide-react";
import {
  AuthUser,
  getStoredUser,
  setStoredUser,
  clearStoredUser,
  onAuthChanged,
} from "../lib/auth";

type Props = {
  primaryColor: string;
};

export default function UserMenu({ primaryColor }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getStoredUser());
    setHydrated(true);

    const unsubscribe = onAuthChanged(() => {
      setUser(getStoredUser());
    });

    // Use cookie-based auth (works with httpOnly cookies).
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.success && data.user) {
          setStoredUser({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
          });
        } else {
          clearStoredUser();
        }
      })
      .catch(() => {});

    return unsubscribe;
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    clearStoredUser();
    setUser(null);
    setOpen(false);
    window.location.href = "/";
  }

  if (!hydrated) {
    return <div className="w-24 h-10" aria-hidden />;
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        prefetch
        className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border-2 bg-white/60 backdrop-blur transition-all duration-300 hover:scale-105 hover:shadow-md"
        style={{ borderColor: primaryColor, color: primaryColor }}
      >
        <User size={16} strokeWidth={2.5} />
        Hyr
      </Link>
    );
  }

  const firstName = user.full_name.split(" ")[0] || user.full_name;
  const initials = user.full_name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 text-sm font-semibold pl-1 pr-3 py-1 rounded-full border-2 bg-white/60 backdrop-blur transition-all duration-300 hover:scale-105 hover:shadow-md"
        style={{ borderColor: primaryColor, color: primaryColor }}
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: primaryColor }}
        >
          {initials || "U"}
        </span>
        <span className="max-w-[120px] truncate">{firstName}</span>
        <ChevronDown size={14} strokeWidth={2.5} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-white shadow-xl py-2 z-50"
        >
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium"
          >
            <User size={16} />
            Profili
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-semibold"
          >
            <LogOut size={16} strokeWidth={2.5} />
            Dil
          </button>
        </div>
      )}
    </div>
  );
}
