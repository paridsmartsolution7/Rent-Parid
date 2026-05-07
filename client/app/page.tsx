"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Search, ShoppingBag, Tag, MapPin, Phone, Clock, Globe, Truck, Package, Briefcase, CreditCard, Undo2, type LucideIcon } from "lucide-react";
import ProductCard from "./components/ProductCardFixed";
import ShowAllCard from "./components/ShowAllCard";
import BlogCarousel from "./components/BlogCarousel";
import NewsletterForm from "./components/NewsletterForm";
import Navbar from "./components/Navbar";
import ProfileCompleteModal from "./components/ProfileCompleteModal";
import { getFavorites, toggleFavorite as toggleFavoriteStorage, onFavoritesChanged } from "./lib/favorites";
import { cachedFetch } from "./lib/clientCache";
import { CategoryIcon } from "./lib/categoryIcon";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  categoryName: string;
  image: string;
  imageCount?: number;
  description: string;
  rating: number;
  stock: number;
  unit?: string;
};

type CartItem = Product & { qty: number; itemType?: 'AR' | 'SH' };

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type Config = {
  company_name: string;
  logo_url: string | null;
  navbar_color: string;
  primary_color: string;
  secondary_color: string;
  hero_title: string;
  hero_subtitle: string;
  hero_button_text: string;
  cart_button_text: string;
  currency_symbol: string;
  show_stock_warning: boolean;
  show_ratings: boolean;
  items_per_page: number;
  top_banner_text?: string | null;
  categories_section_title?: string | null;
  categories_section_subtitle?: string | null;
  banner_image_text?: string | null;
  banner_image_url?: string | null;
  banner_image_eyebrow?: string | null;
  about_eyebrow?: string | null;
  about_title?: string | null;
  about_text?: string | null;
  about_image_url?: string | null;
  about_image_caption?: string | null;
  about_maps_button_text?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  delivery_note?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  portal_url?: string | null;
  maps_url?: string | null;
};

// Brand palette
const GREEN = '#1F3E76';
const GREEN_DARK = '#1F3E76';
const CREAM = '#f5f2ef';
const YELLOW = '#FFB300';

export default function Home() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    setCartLoaded(true);
  }, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [toast, setToast] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<{ Kodi: string; Pershkrim: string; has_image?: boolean }[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [hero, setHero] = useState<{ hero_title: string; hero_subtitle: string } | null>(null);
  // Hero decoration: cache-busted URL when admin has uploaded an image, null otherwise.
  const [heroDecorationUrl, setHeroDecorationUrl] = useState<string | null>(null);
  // Hero background image — admin uploads via Hero → "Zgjidh imazh banner".
  // When present, used as the homepage hero background; when absent, the
  // existing soft gradient stays.
  const [heroBgUrl, setHeroBgUrl] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [services, setServices] = useState<{ id: number; kodi: string; name: string; price: number; unit: string }[]>([]);
  const [featuredTab, setFeaturedTab] = useState<string>('All');

  // Fetch config and categories on mount. Use a 10s TTL on the slow-changing
  // config + hero so admin edits propagate to the homepage within seconds —
  // these payloads are tiny so the extra refetch is essentially free.
  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config', undefined, 10_000)
      .then(data => {
        if (data.success) {
          setConfig(data.config);
          setPagination(prev => ({ ...prev, limit: data.config.items_per_page }));
        }
      })
      .catch(err => console.error('Failed to fetch config:', err));

    cachedFetch<{ success: boolean; hero: { hero_title: string; hero_subtitle: string } }>('/api/hero', undefined, 10_000)
      .then(data => {
        if (data.success && data.hero) setHero(data.hero);
      })
      .catch(err => console.error('Failed to fetch hero:', err));

    // Probe the decoration image; only render <img> when it actually exists.
    fetch('/api/hero/decoration', { method: 'HEAD' })
      .then(r => {
        if (r.ok) setHeroDecorationUrl(`/api/hero/decoration?v=${Date.now()}`);
      })
      .catch(() => {/* no decoration uploaded — emoji fallback stays */});

    // Optimistically set the hero bg URL. If the image 404s, the <img>
    // onError handler clears it so the gradient fallback takes over. This
    // is more reliable than a HEAD probe — Next.js 16 route handlers don't
    // always respond cleanly to HEAD when only GET is exported.
    setHeroBgUrl(`/api/hero/image?v=${Date.now()}`);

    cachedFetch<{ success: boolean; categories: { Kodi: string; Pershkrim: string; has_image?: boolean }[] }>('/api/categories')
      .then(data => {
        if (data.success) {
          setCategories(data.categories);
        }
      })
      .catch(err => console.error('Failed to fetch categories:', err));

    // Gate Sherbimet by the global services_enabled toggle (admin can hide
    // the entire section without changing data).
    fetch('/api/config/flags')
      .then(r => r.json())
      .then(flagsRes => {
        if (!flagsRes?.flags?.services_enabled) return; // skip fetch entirely
        return fetch('/api/services').then(r => r.json());
      })
      .then(d => {
        if (d?.success) setServices(d.services);
      })
      .catch(() => {});

    setFavoriteIds(new Set<number>(getFavorites()));
    const unsubscribe = onFavoritesChanged(() => {
      setFavoriteIds(new Set<number>(getFavorites()));
    });
    return unsubscribe;
  }, []);

  async function toggleFavorite(productId: number) {
    const nowFavorite = await toggleFavoriteStorage(productId);
    showToast(nowFavorite ? 'Shtuar ne te preferuarat' : 'Hequr nga te preferuarat');
  }

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (search.length >= 2) {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`, { cache: 'no-store' });
          const data = await res.json();
          if (data.success) {
            setProducts(data.products);
          }
        } catch (err) {
          console.error("Failed to search products:", err);
        } finally {
          setLoading(false);
        }
      }, 300);
      return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }

    async function fetchProducts() {
      setLoading(true);
      try {
        const isAll = !category || category === 'All';
        const params = new URLSearchParams({
          category,
          search: '',
          sortBy,
          ...(isAll
            ? { grouped: 'true', perGroup: '8' }
            : { page: pagination.page.toString(), limit: pagination.limit.toString() })
        });

        const res = await fetch(`/api/products?${params}`, { cache: 'no-store' });
        const data = await res.json();

        if (data.success) {
          setProducts(data.products);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [pagination.page, pagination.limit, category, search, sortBy]);

  function changePage(newPage: number) {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeLimit(newLimit: number) {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  }

  function getPageNumbers() {
    const { page, totalPages } = pagination;
    const pages: number[] = [];
    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push(-1);
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push(-1);
      pages.push(totalPages);
    }
    return pages;
  }

  function changeCategory(cat: string) {
    setCategory(cat);
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  }
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  type ProfileGap = {
    missing: { phone: boolean; address: boolean; city: boolean; postal_code: boolean };
    currentUser: { phone: string; address: string; city: string; postal_code: string };
  };
  const [profileGap, setProfileGap] = useState<ProfileGap | null>(null);

  async function doCheckout(items: CartItem[]): Promise<'ok' | 'unauthorized' | 'profile' | 'error'> {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: items.map(i => ({ product_id: i.id, qty: i.qty })),
        }),
      });
      if (res.status === 401) return 'unauthorized';
      const data = await res.json();
      if (!data.success) {
        if (data.reason === 'incomplete-profile') {
          setProfileGap({ missing: data.missing, currentUser: data.currentUser });
          return 'profile';
        }
        showToast(data.message || 'Pagesa deshtoi');
        return 'error';
      }
      showToast(data.message || `Konfirmoni porosine ne gmail`);
      setCart([]);
      try { localStorage.removeItem('cart'); } catch {}
      setCartOpen(false);
      return 'ok';
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Pagesa deshtoi');
      return 'error';
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('pendingCheckout') !== '1') return;
    try {
      const saved = localStorage.getItem('cart');
      const items: CartItem[] = saved ? JSON.parse(saved) : [];
      localStorage.removeItem('pendingCheckout');
      if (items.length > 0) {
        setCartOpen(true);
        showToast('Shporta juaj eshte gati — klikoni Perfundo porosine per te vazhduar.');
      }
    } catch {
      localStorage.removeItem('pendingCheckout');
    }
  }, []);

  function addToCart(product: Product) {
    // Block + show OOS toast ONLY when admin has disabled OOS orders. When
    // allow_out_of_stock_orders is on (default), zero-stock items add to the
    // cart silently — the backend will still validate at checkout.
    if (product.stock <= 0 && (config as any)?.allow_out_of_stock_orders === false) {
      const msg = (config as any)?.out_of_stock_message || 'Ky produkt nuk ka gjendje per momentin';
      showToast(msg);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    showToast(`${product.name} u shtua ne shporte`);
  }

  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQty(id: number, qty: number) {
    if (qty < 1) return removeFromCart(id);
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Top 10 categories shown in the hero category grid (Kazidomi shows 10 in 5×2)
  const heroCategories = useMemo(() => categories.slice(0, 10), [categories]);

  // Featured / bestsellers section: when "All" tab show first products,
  // otherwise filter by selected tab category code.
  const featuredProducts = useMemo(() => {
    if (featuredTab === 'All') return products.slice(0, 8);
    return products.filter(p => p.category === featuredTab).slice(0, 8);
  }, [products, featuredTab]);

  return (
    <div className="min-h-screen font-sans" style={{ background: '#FFFFFF' }}>
      {/* Top promo banner */}
      <div className="text-white text-xs sm:text-sm font-medium text-center py-2 px-4" style={{ backgroundColor: GREEN_DARK }}>
        <span className="inline-flex items-center gap-2">
          <Truck size={16} strokeWidth={2} />
          {config?.top_banner_text || 'Bejme dergesa ne te gjithe Shqiperine'}
        </span>
      </div>

      <Navbar config={config} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      {/* Hero — uses the admin-uploaded banner image as background when set.
          Strategy: ALWAYS render the gradient as base, then layer the uploaded
          image (and a translucent white veil) above it. If the image 404s
          (no upload), onError hides it so the gradient shows through.
          Avoids negative z-index (which can lose stacking races inside Tailwind
          layouts) and the unreliable HEAD probe. */}
      <section className="relative overflow-hidden">
        {/* Base gradient + decorative blobs — white → soft blue palette */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, #FFFFFF 0%, #F0F6FF 55%, #DBEAFE 100%)`,
            zIndex: 0,
          }}
        />
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30"
          style={{ backgroundColor: GREEN, zIndex: 0 }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25"
          style={{ backgroundColor: '#93C5FD', zIndex: 0 }}
        />
        {/* Uploaded background — full image always visible (object-contain),
            responsive to viewport size. The image scales down to fit the
            section while preserving its aspect ratio; any letterbox area
            falls back to the gradient + cream beneath. The veil is reduced
            so the brand colors of the photo show through. Auto-hides on 404. */}
        {heroBgUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroBgUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-contain object-center"
              style={{ zIndex: 1 }}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.style.display = 'none';
                const veil = img.nextElementSibling as HTMLElement | null;
                if (veil) veil.style.display = 'none';
                setHeroBgUrl(null);
              }}
            />
            <div
              className="absolute inset-0 bg-white/40"
              style={{ zIndex: 2 }}
            />
          </>
        )}

        <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-16 grid md:grid-cols-2 gap-10 items-center" style={{ zIndex: 3 }}>
          <div className="text-center md:text-left">
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white shadow-sm text-xs font-bold uppercase tracking-wider mb-5"
              style={{ color: GREEN_DARK }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: GREEN }} />
              Ofertat e fundit
            </span>
            {/* Hero title + subtitle: admin-controlled. Default is empty —
                if neither /api/hero (DB2) nor /api/config (DB1) carries a
                value, NOTHING renders. The hardcoded "Organic Products" /
                long Albanian subtitle fallbacks were removed so a fresh
                install (or an explicit clear in admin) shows a clean hero
                with just the badge + buttons. */}
            {(() => {
              const t = (hero?.hero_title ?? config?.hero_title ?? '').trim();
              if (!t) return null;
              const parts = t.split(' ');
              return (
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-5 tracking-tight leading-[1.15] text-gray-900">
                  {parts.length >= 2
                    ? <><span style={{ color: GREEN }}>{parts[0]}</span> {parts.slice(1).join(' ')}</>
                    : <span style={{ color: GREEN }}>{t}</span>}
                </h1>
              );
            })()}
            {(() => {
              const s = (hero?.hero_subtitle ?? config?.hero_subtitle ?? '').trim();
              if (!s) return null;
              return (
                <p className="text-gray-600 text-base md:text-lg mb-8 max-w-xl md:mx-0 mx-auto">
                  {s}
                </p>
              );
            })()}
            <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
              <button
                onClick={() => router.push('/shop')}
                className="inline-flex items-center gap-2 text-white font-semibold px-7 py-3.5 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                style={{ backgroundColor: GREEN }}
              >
                {config?.hero_button_text || 'Zbulo programe & pajisje'}
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 font-semibold px-6 py-3.5 rounded-full bg-white shadow-sm text-gray-800 hover:bg-gray-50 transition"
              >
                Shfleto produktet
              </button>
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-4 sm:gap-6 mt-8 justify-center md:justify-start text-xs sm:text-sm text-gray-600">
              <span className="inline-flex items-center gap-1.5"><span style={{ color: GREEN }}>✓</span> Dergesa 48h</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ color: GREEN }}>✓</span> Software i ligjshem</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ color: GREEN }}>✓</span> Mbeshtetje 24/7</span>
            </div>
          </div>

          {/* Right: hero decoration. Only renders when admin has uploaded a
              custom image (POST /api/hero/decoration); otherwise the column
              stays empty so the hero text section breathes. */}
          {heroDecorationUrl && (
            <div className="relative hidden md:flex items-center justify-center h-96">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroDecorationUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      </section>

      {/* Search */}
      <div className="relative max-w-3xl mx-auto px-4 -mt-4 mb-10 z-10">
        <div className="relative flex items-center bg-white rounded-full shadow-xl overflow-hidden">
          <Search size={20} strokeWidth={2.5} color="#9ca3af" className="ml-5" />
          <input
            type="text"
            placeholder="Kerko sipas emrit te produktit, markes, kategorise..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 px-4 py-3 sm:py-4 text-sm text-black placeholder-gray-500 bg-transparent focus:outline-none"
          />
          {search && (
            <button onClick={() => handleSearch('')} className="mr-2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition" aria-label="Pastro kerkimin">✕</button>
          )}
          <button
            onClick={() => document.getElementById("featured")?.scrollIntoView({ behavior: "smooth" })}
            className="mr-2 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-300 hover:scale-105 shadow-md"
            style={{ backgroundColor: GREEN }}
          >
            Kerko
          </button>
        </div>
      </div>

      {/* Categories grid (5 × 2 on desktop) */}
      {heroCategories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <div className="text-center mb-10 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-3">
              {config?.categories_section_title || 'Kategoritë e produkteve'}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              {config?.categories_section_subtitle ||
                'Zgjidhje teknologjike te certifikuara per biznesin tuaj — nga POS dhe fiskalizimi, deri tek pajisjet profesionale.'}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            {heroCategories.map((c) => (
              <Link
                key={c.Kodi}
                href={`/${encodeURIComponent(c.Pershkrim)}`}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-4 sm:p-5 flex flex-col items-center text-center overflow-hidden"
              >
                {/* Image circle: uploaded category image when present, otherwise
                    the cream-circle CategoryIcon fallback. */}
                {c.has_image ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-2 ring-[#EAF5DA] mb-2 transition-transform duration-300 group-hover:scale-110">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/categories/${encodeURIComponent(c.Kodi)}/image`}
                      alt={c.Pershkrim}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Image was removed between fetch and render — swap to icon fallback.
                        const img = e.currentTarget as HTMLImageElement;
                        const wrapper = img.parentElement;
                        if (wrapper) {
                          wrapper.outerHTML = `<div class="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-2" style="background-color:#EAF5DA"></div>`;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: '#EAF5DA' }}
                  >
                    <CategoryIcon name={c.Pershkrim} size={28} color={GREEN_DARK} />
                  </div>
                )}
                <span className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2">{c.Pershkrim}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Promo banner section removed — the uploaded /api/hero/image is now
          used as the hero background at the top of the page instead. */}

      {/* Feature highlights row */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {([
            { Icon: Truck, title: 'Dergesa e shpejte', sub: 'Brenda 48 oreve' },
            { Icon: Package, title: 'Cilesi Profesionale', sub: 'Te certifikuara' },
            { Icon: CreditCard, title: 'Pagese e sigurte', sub: 'Online ose ne dorezim' },
            { Icon: Undo2, title: 'Kthim falas', sub: 'Brenda 14 ditesh' },
          ] as { Icon: LucideIcon; title: string; sub: string }[]).map((f, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm p-4 sm:p-5 flex items-center gap-3 hover:shadow-md transition">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#EAF5DA' }}
              >
                <f.Icon size={26} strokeWidth={1.75} color={GREEN_DARK} />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm sm:text-base">{f.title}</p>
                <p className="text-xs text-gray-500">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured / Bestsellers with category tabs */}
      <section id="featured" className="max-w-7xl mx-auto px-4 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: GREEN_DARK }}>
              Me te shituarit
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Bestsellers</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFeaturedTab('All')}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${featuredTab === 'All' ? 'text-white shadow-md' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'}`}
              style={featuredTab === 'All' ? { backgroundColor: GREEN } : undefined}
            >
              Te gjitha
            </button>
            {categories.slice(0, 5).map(c => (
              <button
                key={c.Kodi}
                onClick={() => setFeaturedTab(c.Kodi)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${featuredTab === c.Kodi ? 'text-white shadow-md' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'}`}
                style={featuredTab === c.Kodi ? { backgroundColor: GREEN } : undefined}
              >
                {c.Pershkrim}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
                <div className="bg-gray-200 h-48 sm:h-64" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-5 bg-gray-200 rounded w-16" />
                    <div className="h-8 bg-gray-200 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nuk u gjeten produkte ne kete kategori.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map(p => (
              <ProductCard
                key={p.id}
                product={p}
                onAdd={addToCart}
                onRemoveFromCart={removeFromCart}
                config={config}
                isFavorite={favoriteIds.has(p.id)}
                onToggleFavorite={toggleFavorite}
                isInCart={cart.some(i => i.id === p.id)}
                onCartOpen={() => setCartOpen(true)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Existing per-category product groups (preserved logic) */}
      <div id="products" />
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {!loading && products.length > 0 && (() => {
          const grouped = products.reduce<Record<string, Product[]>>((acc, product) => {
            const group = product.categoryName || 'General';
            if (!acc[group]) acc[group] = [];
            acc[group].push(product);
            return acc;
          }, {});

          const orderedEntries = Object.entries(grouped).sort(([a], [b]) => {
            if (a === 'General') return 1;
            if (b === 'General') return -1;
            return 0;
          });

          return orderedEntries.map(([groupName, groupProducts]) => {
            const visibleProducts = groupProducts.slice(0, 3);
            return (
              <div key={groupName} className="mb-12">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900">
                    {groupName}
                    <span className="text-sm font-medium text-gray-400 ml-2">({groupProducts.length})</span>
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {visibleProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAdd={addToCart}
                      onRemoveFromCart={removeFromCart}
                      config={config}
                      isFavorite={favoriteIds.has(product.id)}
                      onToggleFavorite={toggleFavorite}
                      isInCart={cart.some(i => i.id === product.id)}
                      onCartOpen={() => setCartOpen(true)}
                    />
                  ))}
                  <ShowAllCard
                    href={`/${encodeURIComponent(groupName)}`}
                    label={`Te gjitha produktet ${groupName}`}
                  />
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Pagination (when single category) */}
      {!loading && products.length > 0 && category && category !== 'All' && (
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Artikuj per faqe:</span>
              <select
                value={pagination.limit}
                onChange={(e) => changeLimit(parseInt(e.target.value))}
                className="border border-gray-300 bg-white text-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
                style={{ outlineColor: GREEN }}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
            <span className="text-sm text-gray-500">
              Duke shfaqur {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} nga {pagination.total} produkte
            </span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => changePage(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Pas
            </button>
            <div className="flex gap-1">
              {getPageNumbers().map((page, idx) =>
                page === -1 ? (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => changePage(page)}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition"
                    style={
                      page === pagination.page
                        ? { backgroundColor: GREEN, color: '#fff' }
                        : { background: '#fff', border: '1px solid #d1d5db', color: '#374151' }
                    }
                  >
                    {page}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => changePage(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Para
            </button>
          </div>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Sherbimet tona</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {services.map(s => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: '#EAF5DA' }}>
                  <Briefcase size={22} color={GREEN_DARK} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  {s.price > 0 ? (
                    <p className="text-lg font-bold" style={{ color: GREEN_DARK }}>
                      L{s.price.toFixed(2)}{s.unit ? '/' + s.unit : ''}
                    </p>
                  ) : <span />}
                  <button
                    onClick={() => {
                      setCart(prev => {
                        const existing = prev.find(i => i.id === s.id && i.itemType === 'SH');
                        if (existing) return prev.map(i => i.id === s.id && i.itemType === 'SH' ? { ...i, qty: i.qty + 1 } : i);
                        return [...prev, { id: s.id, name: s.name, price: s.price || 0, category: '', categoryName: '', image: '', description: '', rating: 0, stock: 999, unit: s.unit, qty: 1, itemType: 'SH' as const }];
                      });
                      showToast(`${s.name} u shtua ne shporte`);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-md text-gray-700 hover:shadow-lg transition"
                    style={{ color: GREEN_DARK }}
                    aria-label="Shto ne shporte"
                  >
                    <ShoppingBag size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About Us */}
      <section id="about" className="max-w-7xl mx-auto px-4 pb-16 scroll-mt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="relative rounded-3xl overflow-hidden h-64 sm:h-80 md:h-[28rem] shadow-lg order-2 md:order-1 bg-[#f5f2ef]">
            {/* Image priority: admin-uploaded binary (POST /api/about/image)
                > legacy about_image_url > picsum default. Chained via onError.
                object-contain so the FULL uploaded image is visible regardless
                of aspect ratio; cream background fills any letterbox area. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/about/image"
              alt={config?.company_name || 'PSS Shop'}
              className="absolute inset-0 w-full h-full object-contain"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                const fallback = config?.about_image_url || 'https://picsum.photos/seed/pss-shop-about/900/700';
                if (img.src.endsWith('/api/about/image')) img.src = fallback;
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 px-5 py-4 text-white text-sm font-semibold"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)' }}
            >
              {config?.about_image_caption || 'Tiranë, Shqipëri'}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.3em] mb-3" style={{ color: GREEN_DARK }}>
              {config?.about_eyebrow || 'QË PREJ 2019 • MADE IN ALBANIA'}
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 mb-5 leading-tight">
              {config?.about_title || 'Ndërtuar për biznese që kërkojnë kontroll real.'}
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed whitespace-pre-line">
              {config?.about_text ||
                `Një sistem i vetëm për menaxhimin e shitjeve, stokut, financave dhe fiskalizimit. Më pak punë manuale – më shumë kontroll në kohë reale.

Kush jemi: Parid Smart Solution ofron programe profesionale për fiskalizimin, kontabilitetin dhe manaxhimin e biznesit, të shoqëruara edhe me pajisje POS. Ndihmojmë bizneset të punojnë më thjeshtë, më shpejt dhe në përputhje me ligjin.

Misioni: T'u japim bizneseve mjete të thjeshta, të sakta dhe të ligjshme për të menaxhuar çdo proces ditor.

Vizioni: Të jemi programi më i besueshëm i menaxhimit financiar dhe fiskal në Shqipëri.`}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {config?.contact_phone && (
                <a
                  href={`tel:${config.contact_phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition"
                  style={{ backgroundColor: GREEN }}
                >
                  <Phone size={16} strokeWidth={2.5} />
                  {config.contact_phone}
                </a>
              )}
              {config?.maps_url && (
                <a
                  href={config.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-full bg-white shadow-sm hover:shadow-md transition"
                  style={{ color: GREEN_DARK }}
                >
                  <MapPin size={16} strokeWidth={2.5} />
                  {config?.about_maps_button_text || 'Shiko ne harte'}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Latest blog posts — discovery surface above the newsletter, before footer */}
      <BlogCarousel />

      {/* Newsletter / CTA */}
      <section className="max-w-7xl mx-auto px-4 pb-16">
        <div
          className="rounded-3xl px-6 py-10 sm:px-12 sm:py-14 text-center text-white shadow-xl"
          style={{ background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)` }}
        >
          <h3 className="text-2xl sm:text-3xl font-extrabold mb-2">Bashkohu me komunitetin tone</h3>
          <p className="text-white/90 mb-6 max-w-xl mx-auto">Lajmet me te fundit, keshilla per biznesin dhe ofertat ekskluzive — direkt ne email.</p>
          <NewsletterForm primary={GREEN_DARK} onToast={showToast} />
        </div>
      </section>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="w-full sm:max-w-sm bg-white text-gray-900 h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-bold">Shporta juaj ({cartCount})</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {cart.length === 0 ? (
                <p className="text-gray-600 text-center mt-10">Shporta juaj eshte bosh.</p>
              ) : (
                cart.map((item) => {
                  const currency = config?.currency_symbol || 'Lek';
                  const fixed = item.price.toFixed(2);
                  const [intPart, decPart] = fixed.split('.');
                  const hasDec = decPart !== '00';
                  return (
                    /* min-w-0 + truncate inside lets long product names
                       shrink instead of pushing qty + delete off-screen.
                       Image is a fixed 48×48 thumb — falls back to the
                       tenant logo (NOT the barcode-as-text that was
                       overflowing the row before). Name is bumped from
                       text-sm to text-base/font-semibold; price uses the
                       new "70 Lek" format with smaller grey currency. */
                    <div key={item.id} className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0 w-12 h-12 rounded bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                        {(item.imageCount ?? 0) > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/products/${item.id}/image`}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src="/api/logo"
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="w-3/4 h-3/4 object-contain opacity-40"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-gray-900 truncate" title={item.name}>{item.name}</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">
                          {hasDec ? `${intPart}.${decPart}` : intPart}
                          <span className="text-xs font-medium text-gray-500 ml-1">{currency}</span>
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <button onClick={() => updateQty(item.id, item.qty - 1)} className="w-7 h-7 rounded border border-gray-300 bg-white text-sm text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center">−</button>
                        <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)} className="w-7 h-7 rounded border border-gray-300 bg-white text-sm text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center">+</button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="shrink-0 text-red-500 hover:text-red-700 text-base" aria-label="Hiq">🗑</button>
                    </div>
                  );
                })
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-5 py-4 border-t space-y-3">
                <div className="flex justify-between font-semibold text-lg">
                  <span>Totali</span>
                  {(() => {
                    const fixed = cartTotal.toFixed(2);
                    const [intP, decP] = fixed.split('.');
                    const hasDec = decP !== '00';
                    return (
                      <span>
                        {hasDec ? `${intP}.${decP}` : intP}
                        <span className="text-sm font-medium text-gray-500 ml-1">{config?.currency_symbol || 'Lek'}</span>
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={async () => {
                    const result = await doCheckout(cart);
                    if (result === 'unauthorized') {
                      try {
                        localStorage.setItem('pendingCheckout', '1');
                        localStorage.setItem('returnAfterLogin', window.location.pathname);
                      } catch {}
                      showToast("Ju lutem hyni per te vazhduar");
                      setCartOpen(false);
                      router.push("/auth");
                    }
                  }}
                  className="w-full text-white py-3 rounded-full font-semibold transition"
                  style={{ backgroundColor: GREEN }}
                >
                  Perfundo porosine
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {profileGap && (
        <ProfileCompleteModal
          missing={profileGap.missing}
          initial={profileGap.currentUser}
          onCancel={() => setProfileGap(null)}
          onSaved={() => {
            setProfileGap(null);
            doCheckout(cart);
          }}
        />
      )}
    </div>
  );
}
