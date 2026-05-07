"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ShoppingCart, X, Menu, Heart, User, LogOut, Search } from "lucide-react";
import UserMenu from "./UserMenu";
import NavbarSearch from "./NavbarSearch";
import {
  AuthUser,
  getStoredUser,
  setStoredUser,
  clearStoredUser,
  onAuthChanged,
} from "../lib/auth";

type NavbarProps = {
  config: {
    company_name?: string;
    logo_url?: string | null;
    navbar_color?: string;
    cart_button_text?: string;
    currency_symbol?: string;
  } | null;
  cartCount: number;
  onCartOpen: () => void;
};

const NAV_ITEMS = [
  { href: '/', label: 'Kryefaqja' },
  { href: '/shop', label: 'Te gjitha' },
  { href: '/deals', label: 'Oferta' },
  { href: '/blog', label: 'Blog' },
  { href: '/favorites', label: 'Te preferuarat' },
];

export default function Navbar({ config, cartCount, onCartOpen }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const primaryColor = '#1F3E76';

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getStoredUser());
    setHydrated(true);

    const unsubscribe = onAuthChanged(() => setUser(getStoredUser()));

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
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

  // Close mobile menu and search overlay on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [mobileOpen]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    clearStoredUser();
    setUser(null);
    setMobileOpen(false);
    window.location.href = "/";
  }

  const firstName = user?.full_name.split(" ")[0] || user?.full_name;
  const initials = user?.full_name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="sticky top-0 z-40 px-3 sm:px-4 pt-2">
      <nav className="max-w-7xl mx-auto bg-white rounded-full shadow-xl">
        <div className="w-full px-3 sm:px-6 h-14 sm:h-20 flex items-center justify-between gap-2 sm:gap-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            {/* Logo priority: admin-uploaded binary (POST /api/logo) wins;
                onError falls back to legacy logo_url; if both missing the
                inline SVG below renders. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/logo"
              alt={config?.company_name || 'Logo'}
              className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-full object-cover ring-2 ring-white shadow-sm"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.endsWith('/api/logo') && config?.logo_url) {
                  img.src = config.logo_url;
                } else {
                  img.style.display = 'none';
                  // Reveal the inline SVG sibling.
                  const sibling = img.nextElementSibling as HTMLElement | null;
                  if (sibling) sibling.style.display = '';
                }
              }}
            />
            <div style={{ display: 'none' }}>
              {/* hidden until onError reveals it */}
              <svg viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet" className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16">
                <g transform="translate(0,512) scale(0.1,-0.1)" fill="#1F3E76" stroke="none">
                  <path d="M1420 4478 c-102 -61 -273 -163 -380 -227 l-195 -116 -3 -1567 -2 -1566 222 -133 c123 -73 301 -179 396 -236 95 -56 175 -103 178 -103 5 0 190 107 1069 615 50 29 360 209 690 400 330 191 614 356 630 365 17 10 79 46 138 81 l108 64 0 490 0 490 -143 84 c-79 46 -219 129 -313 184 -93 55 -217 128 -275 162 -58 34 -181 107 -275 162 -236 139 -691 405 -1140 668 -209 122 -407 239 -440 259 -33 20 -64 36 -70 35 -5 0 -93 -51 -195 -111z m294 -287 c143 -83 248 -143 706 -409 223 -129 464 -269 535 -310 72 -41 211 -122 310 -179 99 -58 227 -132 285 -166 58 -33 125 -72 150 -87 25 -15 71 -42 103 -59 31 -18 57 -36 57 -41 0 -6 -822 -482 -859 -498 -4 -1 -7 46 -8 105 -2 245 -103 464 -278 606 -33 26 -105 71 -160 98 -153 78 -1335 763 -1335 774 0 11 358 223 379 224 7 1 59 -25 115 -58z m-353 -572 c501 -294 579 -341 579 -349 0 -4 -15 -13 -32 -21 -60 -23 -165 -97 -222 -154 -76 -78 -139 -182 -177 -295 l-32 -95 -4 -885 c-2 -487 -7 -887 -9 -889 -3 -3 -17 3 -32 12 -15 9 -91 54 -169 99 -78 46 -145 90 -148 98 -9 21 6 2610 15 2610 4 0 108 -59 231 -131z m1010 -575 c164 -48 300 -175 353 -329 79 -227 -36 -520 -246 -623 -82 -40 -134 -51 -241 -52 -199 0 -365 99 -452 269 -74 148 -74 325 0 477 99 203 369 322 586 258z m1597 -605 l-3 -232 -100 -57 c-55 -32 -188 -108 -295 -170 -107 -62 -337 -195 -510 -295 -358 -207 -598 -345 -768 -444 -64 -37 -208 -120 -319 -184 -111 -64 -207 -117 -213 -117 -7 0 -10 161 -10 500 0 344 3 500 11 500 5 0 40 -18 76 -40 84 -50 158 -78 253 -96 98 -17 158 -17 261 1 113 19 156 36 269 101 900 519 1327 762 1338 763 10 1 12 -48 10 -230z" />
                  <path d="M2151 2784 c-143 -50 -205 -209 -137 -347 63 -130 213 -174 346 -101 189 103 141 408 -71 453 -65 14 -85 13 -138 -5z" />
                </g>
              </svg>
            </div>
            <span className="text-sm sm:text-base md:text-lg font-extrabold tracking-tight text-gray-900">
              {config?.company_name || 'PSS Shop'}
            </span>
          </button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-2 text-base font-semibold">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const cls = `relative px-5 py-2.5 rounded-full transition-all duration-300 group ${isActive ? 'text-white' : 'text-gray-700 hover:text-white'}`;
              const content = (
                <>
                  <span
                    className={`absolute inset-0 rounded-full transition-opacity duration-300 shadow-md ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span className="relative">{item.label}</span>
                </>
              );
              return (
                <Link key={item.label} href={item.href} className={cls}>{content}</Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Kerko"
              className="w-10 h-10 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition"
            >
              <Search size={20} strokeWidth={2.5} />
            </button>

            <button
              onClick={onCartOpen}
              className="relative flex items-center gap-1.5 sm:gap-2 text-white px-2.5 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingCart size={16} strokeWidth={2.5} />
              <span className="hidden sm:inline">{config?.cart_button_text || 'Shporta'}</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Desktop user menu */}
            <div className="hidden md:block">
              <UserMenu primaryColor={primaryColor} />
            </div>

            {/* Mobile burger */}
            <div ref={mobileMenuRef} className="md:hidden relative">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menu"
                aria-expanded={mobileOpen}
                className="w-10 h-10 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition"
              >
                {mobileOpen ? (
                  <X size={22} strokeWidth={2.5} />
                ) : (
                  <Menu size={22} strokeWidth={2.5} />
                )}
              </button>

              {mobileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white shadow-xl py-2 z-50"
                >
                  {NAV_ITEMS.map((item) => {
                    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                    const isFavorites = item.href === '/favorites';
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        style={isActive ? { backgroundColor: primaryColor } : undefined}
                      >
                        <span>{item.label}</span>
                        {isFavorites && (
                          <Heart size={16} fill={isActive ? 'currentColor' : 'none'} />
                        )}
                      </Link>
                    );
                  })}

                  <div className="border-t border-gray-100 my-1" />

                  {!hydrated ? (
                    <div className="h-10" aria-hidden />
                  ) : user ? (
                    <>
                      <div className="px-4 py-2 flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {initials || 'U'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{firstName}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setMobileOpen(false)}
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
                    </>
                  ) : (
                    <Link
                      href="/auth"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-left px-4 py-2 text-sm font-semibold flex items-center gap-2"
                      style={{ color: primaryColor }}
                    >
                      <User size={16} strokeWidth={2.5} />
                      Hyr
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <NavbarSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        primaryColor={primaryColor}
      />
    </div>
  );
}
