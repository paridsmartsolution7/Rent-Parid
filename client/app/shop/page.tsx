"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronDown, ShoppingBag } from "lucide-react";
import Navbar from "../components/Navbar";
import CartDrawer from "../components/CartDrawer";
import HeartButton from "../components/HeartButton";
import ProductCard from "../components/ProductCardFixed";
import { getFavorites, toggleFavorite as toggleFavoriteStorage, onFavoritesChanged } from "../lib/favorites";
import { cachedFetch } from "../lib/clientCache";

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
  ofpiActive?: number;
  offerPrice?: number | string | null;
  offerStart?: string | null;
  offerEnd?: string | null;
  discountPercent?: number | string | null;
  unit?: string;
};

type CartItem = Product & { qty: number };

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
};

function isOfferActive(product: Product): boolean {
  if (!product.ofpiActive || !product.offerPrice) return false;
  const now = new Date();
  if (product.offerStart && new Date(product.offerStart) > now) return false;
  if (product.offerEnd && new Date(product.offerEnd) < now) return false;
  return true;
}

export default function ShopPage() {
  // useSearchParams() bails the page out of static prerender, so the inner
  // implementation lives behind a Suspense boundary as Next.js requires.
  return (
    <Suspense fallback={null}>
      <ShopPageInner />
    </Suspense>
  );
}

function ShopPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState(() => searchParams?.get('q') ?? "");
  const [sortBy, setSortBy] = useState("default");
  const [toast, setToast] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<{ Kodi: string; Pershkrim: string }[]>([]);
  const [category, setCategory] = useState("All");
  const [config, setConfig] = useState<Config | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [catOpen, setCatOpen] = useState(true);
  const [sortOpen, setSortOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
    // Reopen cart if returning from login
    if (localStorage.getItem('pendingCheckout') === '1') {
      localStorage.removeItem('pendingCheckout');
      setCartOpen(true);
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config')
      .then(data => {
        if (data.success) {
          setConfig(data.config);
          setPagination(prev => ({ ...prev, limit: data.config.items_per_page }));
        }
      })
      .catch(err => console.error('Failed to fetch config:', err));

    cachedFetch<{ success: boolean; categories: { Kodi: string; Pershkrim: string }[] }>('/api/categories')
      .then(data => {
        if (data.success) setCategories(data.categories);
      })
      .catch(err => console.error('Failed to fetch categories:', err));

    setFavoriteIds(new Set<number>(getFavorites()));
    const unsubscribe = onFavoritesChanged(() => {
      setFavoriteIds(new Set<number>(getFavorites()));
    });
    return unsubscribe;
  }, []);

  // Sync search from ?q= on URL changes (e.g., navbar search submit while
  // already on /shop) so the input and results stay in step with the URL.
  useEffect(() => {
    const q = searchParams?.get('q') ?? "";
    setSearch((prev) => (prev === q ? prev : q));
  }, [searchParams]);

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
          if (data.success) setProducts(data.products);
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
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          ...(isAll ? {} : { categoryName: category }),
          search: '',
          sortBy,
        });

        const res = await fetch(`/api/products?${params}`, { cache: 'no-store' });
        const data = await res.json();

        if (data.success) {
          setProducts(data.products);
          if (data.pagination) setPagination(data.pagination);
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

  function handleSearch(value: string) {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function addToCart(product: Product) {
    // OOS toast only when admin has DISABLED OOS orders. When the
    // "Lejo porosi kur nuk ka gjendje" toggle is on, zero-stock items add
    // silently — backend still validates at checkout.
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

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const currencySymbol = config?.currency_symbol || 'L';
  const primaryColor = '#1F3E76';

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      {/* Main layout: sidebar + content */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sticky left sidebar filters */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-24 space-y-4 bg-white rounded-2xl shadow-sm p-4">
            {/* Search */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wider">Kerko</h3>
              <div className="relative">
                <Search size={16} strokeWidth={2.5} color="#9ca3af" className="absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Kerko produkte..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-8 py-2 text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                />
                {search && (
                  <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div>
              <button
                onClick={() => setCatOpen(v => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wider hover:text-[#1F3E76] transition"
              >
                Kategorite
                <ChevronDown size={16} className={`transition-transform duration-200 ${catOpen ? '' : '-rotate-90'}`} />
              </button>
              {catOpen && (
                <div className="space-y-1 max-h-[50vh] overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
                  <button
                    onClick={() => { setCategory('All'); setPagination(prev => ({ ...prev, page: 1 })); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${category === 'All' ? 'bg-[#1F3E76] text-white font-medium' : 'text-gray-700 bg-blue-50 hover:bg-blue-100'}`}
                  >
                    Te gjitha
                  </button>
                  {categories.map(c => (
                    <button
                      key={c.Kodi}
                      onClick={() => { setCategory(c.Pershkrim); setPagination(prev => ({ ...prev, page: 1 })); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${category === c.Pershkrim ? 'bg-[#1F3E76] text-white font-medium' : 'text-gray-700 bg-blue-50 hover:bg-blue-100'}`}
                    >
                      {c.Pershkrim}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <div>
              <button
                onClick={() => setSortOpen(v => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wider hover:text-[#1F3E76] transition"
              >
                Rendit sipas
                <ChevronDown size={16} className={`transition-transform duration-200 ${sortOpen ? '' : '-rotate-90'}`} />
              </button>
              {sortOpen && (
                <div className="space-y-1">
                  {[
                    { value: 'default', label: 'Normal' },
                    { value: 'price-asc', label: 'Cmimi: Ulet ne te Larte' },
                    { value: 'price-desc', label: 'Cmimi: Larte ne te Ulet' },
                    { value: 'name', label: 'Emri: A-Z' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${sortBy === opt.value ? 'bg-[#1F3E76] text-white font-medium' : 'text-gray-700 bg-blue-50 hover:bg-blue-100'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right content area */}
        <div className="flex-1 min-w-0">
          {/* Results info */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {category === 'All' ? 'Te gjitha produktet' : category}
            </h1>
            {!loading && pagination.total > 0 && (
              <span className="text-sm text-gray-500">
                {pagination.total} produkte
              </span>
            )}
          </div>

          {/* Mobile filters (visible on small screens) */}
          <div className="flex flex-col sm:flex-row md:hidden gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={16} strokeWidth={2.5} color="#9ca3af" className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Kerko..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
              />
            </div>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-700 focus:outline-none"
            >
              <option value="All">Te gjitha</option>
              {categories.map(c => (
                <option key={c.Kodi} value={c.Pershkrim}>{c.Pershkrim}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-700 focus:outline-none"
            >
              <option value="default">Rendit</option>
              <option value="price-asc">Cmimi ↑</option>
              <option value="price-desc">Cmimi ↓</option>
              <option value="name">A-Z</option>
            </select>
          </div>

          {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
                <div className="bg-gray-200 h-48 sm:h-64 md:h-72" />
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
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-lg">Nuk u gjeten produkte.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product as any}
                onAdd={addToCart}
                onRemoveFromCart={removeFromCart}
                config={config as any}
                isFavorite={favoriteIds.has(product.id)}
                onToggleFavorite={toggleFavorite}
                isInCart={cart.some(i => i.id === product.id)}
                onCartOpen={() => setCartOpen(true)}
              />
            ))}
          </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="pb-8 mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Artikuj per faqe:</span>
                  <select
                    value={pagination.limit}
                    onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                    className="border border-gray-300 bg-white text-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  >
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>
                <span className="text-sm text-gray-500">
                  Duke shfaqur {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} nga {pagination.total}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Pas
                </button>
                <div className="flex gap-1">
                  {getPageNumbers().map((page, idx) =>
                    page === -1 ? (
                      <span key={`e-${idx}`} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => changePage(page)}
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition ${
                          page === pagination.page
                            ? "bg-[#1F3E76] text-white"
                            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                </div>
                <button
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Para
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          cartCount={cartCount}
          cartTotal={cartTotal}
          currencySymbol={currencySymbol}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onCheckoutDone={(msg) => showToast(msg)}
          onClearCart={() => setCart([])}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
