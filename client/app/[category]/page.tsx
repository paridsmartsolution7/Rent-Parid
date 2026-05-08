"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import HeartButton from "../components/HeartButton";
import ProductCardFixed from "../components/ProductCardFixed";
import UserMenu from "../components/UserMenu";
import Navbar from "../components/Navbar";
import ProfileCompleteModal from "../components/ProfileCompleteModal";
import { getFavorites, toggleFavorite as toggleFavoriteStorage, onFavoritesChanged } from "../lib/favorites";
import { cachedFetch } from "../lib/clientCache";
import Cookies from "js-cookie";

type Product = {
  id: number;
  name: string;
  price: number;
  category: string;
  categoryName: string;
  image: string;
  description: string;
  rating: number;
  stock: number;
  ofpiActive?: number;
  offerPrice?: number | string | null;
  offerStart?: string | null;
  offerEnd?: string | null;
  discountPercent?: number | string | null;
  unit?: string;
  isNew?: number | boolean;
  isBestseller?: number | boolean;
};

function isOfferActive(product: Product): boolean {
  if (!product.ofpiActive || !product.offerPrice) return false;
  const now = new Date();
  if (product.offerStart && new Date(product.offerStart) > now) return false;
  if (product.offerEnd && new Date(product.offerEnd) < now) return false;
  return true;
}

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

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categorySlug = params.category as string;
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [toast, setToast] = useState<string | null>(null);
  const [profileGap, setProfileGap] = useState<{
    missing: { phone: boolean; address: boolean; city: boolean; postal_code: boolean };
    currentUser: { phone: string; address: string; city: string; postal_code: string };
  } | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [config, setConfig] = useState<Config | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  // Fetch config on mount (session-cached)
  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config')
      .then(data => {
        if (data.success) {
          setConfig(data.config);
          setPagination(prev => ({ ...prev, limit: data.config.items_per_page }));
        }
      })
      .catch(err => console.error('Failed to fetch config:', err));

    // Load favorites from localStorage and subscribe to changes
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

  async function runCheckout() {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map(i => ({ product_id: i.id, qty: i.qty })),
        }),
      });
      if (res.status === 401) {
        try {
          localStorage.setItem('pendingCheckout', '1');
          localStorage.setItem('returnAfterLogin', window.location.pathname);
        } catch {}
        showToast("Ju lutem hyni per te vazhduar");
        setCartOpen(false);
        router.push("/auth");
        return;
      }
      const data = await res.json();
      if (!data.success) {
        if (data.reason === 'incomplete-profile') {
          setProfileGap({ missing: data.missing, currentUser: data.currentUser });
          return;
        }
        showToast(data.message || 'Rezervimi deshtoi');
        return;
      }
      showToast(`Konfirmoni rezervimin ne gmail`);
      setCart([]);
      setCartOpen(false);
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Rezervimi deshtoi');
    }
  }

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // If search has 2+ chars, debounce and call external API
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

    // Normal fetch when no search or less than 2 chars
    async function fetchProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          categoryName: decodeURIComponent(categorySlug),
          search: '',
          sortBy
        });

        const res = await fetch(`/api/products?${params}`, { cache: 'no-store' });
        const data = await res.json();

        if (data.success) {
          setProducts(data.products);
          setPagination(data.pagination);
          if (data.products.length > 0) {
            setCategoryName(data.products[0].categoryName || data.products[0].category);
          }
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [pagination.page, pagination.limit, categorySlug, search, sortBy]);

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
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (page > 3) pages.push(-1);
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push(-1);
      pages.push(totalPages);
    }
    
    return pages;
  }

  function changeSort(sort: string) {
    setSortBy(sort);
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function addToCart(product: Product) {
    // OOS toast only when admin has disabled OOS orders.
    if (product.stock <= 0 && (config as any)?.allow_out_of_stock_orders === false) {
      const msg = (config as any)?.out_of_stock_message || 'Kjo makine nuk eshte e disponueshme per momentin';
      showToast(msg);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
    showToast(`${product.name} u shtua ne rezervim`);
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      {/* Hero */}
      <div
        className="text-white py-16 px-4 text-center"
        style={{
          background: `linear-gradient(to right, ${'#1F3E76'}, ${'#1F3E76'})`
        }}
      >
        <h1 className="text-4xl font-bold mb-3">{categoryName || categorySlug}</h1>
        <p className="text-blue-100 text-lg mb-6">Shfletoni floten tone te makinave</p>
        <button
          onClick={() => router.push('/')}
          className="bg-white font-semibold px-6 py-3 rounded-full hover:opacity-90 transition"
          style={{ color: '#1F3E76' }}
        >
          Kthehu ne Kryefaqje
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <input
            type="text"
            placeholder="Kerko makina..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-full px-4 py-2 text-sm text-black placeholder-black focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
          />
        </div>
      </div>

      {/* Sort */}
      <div id="products" className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">{categoryName}</h2>
          <select
            value={sortBy}
            onChange={(e) => changeSort(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
          >
            <option value="default">Rendit: Normal</option>
            <option value="price-asc">Cmimi/dite: Ulet ne te Larte</option>
            <option value="price-desc">Cmimi/dite: Larte ne te Ulet</option>
            <option value="name">Emri: A-Z</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: Math.min(pagination.limit, 20) }).map((_, idx) => (
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
          <div className="text-center py-20 text-gray-400 text-lg">Nuk u gjeten makina ne kete klase.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCardFixed
                key={product.id}
                product={product as any}
                onAdd={addToCart}
                onRemoveFromCart={(id) => setCart((prev) => prev.filter((i) => i.id !== id))}
                config={config as any}
                isFavorite={favoriteIds.has(product.id)}
                onToggleFavorite={toggleFavorite}
                isInCart={cart.some(i => i.id === product.id)}
                onCartOpen={() => setCartOpen(true)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && products.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Makina per faqe:</span>
              <select
                value={pagination.limit}
                onChange={(e) => changeLimit(parseInt(e.target.value))}
                className="border border-gray-300 bg-white text-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
            
            <span className="text-sm text-gray-500">
              Duke shfaqur {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} nga {pagination.total} makina
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
                  <span key={`ellipsis-${idx}`} className="w-10 h-10 flex items-center justify-center text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => changePage(page)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm shadow-lg z-50 animate-fade-in">
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
            runCheckout();
          }}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  config,
  isFavorite,
  onToggleFavorite,
  isInCart,
  onCartOpen,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  config: Config | null;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  isInCart?: boolean;
  onCartOpen?: () => void;
}) {
  const currencySymbol = config?.currency_symbol || 'L';
  const showStockWarning = config?.show_stock_warning !== false;
  const primaryColor = '#1F3E76';

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition flex flex-col overflow-hidden relative">
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
        {isOfferActive(product) && Number(product.discountPercent) > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            -{Number(product.discountPercent)}%
          </span>
        )}
        {Number(product.isNew) === 1 && (
          <span className="bg-[#1F3E76] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            I ri
          </span>
        )}
        {Number(product.isBestseller) === 1 && (
          <span className="bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            Me e kerkuar
          </span>
        )}
      </div>
      <div className="relative bg-gray-50 flex items-center justify-center h-48 sm:h-64 md:h-72 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-removed-background.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 m-auto w-1/2 h-1/2 object-contain pointer-events-none select-none ${((product as any).imageCount ?? 0) > 0 ? 'opacity-10' : 'opacity-40'}`}
        />
        {((product as any).imageCount ?? 0) > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/products/${product.id}/image`}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="relative w-full h-full object-contain p-3"
          />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: primaryColor }}>{product.category}</span>
        <h3 className="font-semibold text-gray-800 mt-1 mb-3 flex-1">{product.name}</h3>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 min-w-0">
            {isOfferActive(product) ? (
              <>
                <span className="text-lg font-bold text-red-600 break-words">{currencySymbol}{Number(product.offerPrice).toFixed(2)}{product.unit ? '/' + product.unit : ''}</span>
                <span className="text-sm text-gray-400 line-through break-words">{currencySymbol}{product.price.toFixed(2)}</span>
              </>
            ) : (
              <span className="text-lg font-bold text-gray-900 break-words">{currencySymbol}{product.price.toFixed(2)}{product.unit ? '/' + product.unit : ''}</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            {product.stock <= 0 ? (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">E zene</span>
            ) : (
              <Link
                href={`/product/${product.id}`}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-[#1F3E76] transition shrink-0"
                aria-label="Rezervo tani"
              >
                Rezervo tani
              </Link>
            )}
            <HeartButton
              active={isFavorite}
              onClick={() => onToggleFavorite(product.id)}
            />
          </div>
        </div>
        {showStockWarning && product.stock <= 5 && product.stock > 0 && (
          <p className="text-xs text-orange-500 mt-1">Vetem {product.stock} te disponueshme!</p>
        )}
      </div>
    </div>
  );
}
