"use client";

import { useState, useEffect } from "react";
import { Tag } from "lucide-react";
import Navbar from "../components/Navbar";
import CartDrawer from "../components/CartDrawer";
import ProductCard from "../components/ProductCardFixed";
import { cachedFetch } from "../lib/clientCache";
import {
  fetchFavoritesFromDB,
  toggleFavorite as toggleFavoriteStorage,
  onFavoritesChanged,
  getFavorites,
} from "../lib/favorites";

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

type Config = {
  company_name: string;
  navbar_color: string;
  primary_color: string;
  secondary_color: string;
  cart_button_text: string;
  currency_symbol: string;
  show_stock_warning?: boolean;
  show_favorite_button?: boolean;
  price_currency_position?: 'before' | 'after' | string;
};

export default function DealsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cart, setCart] = useState<{ id: number; name: string; price: number; image: string; imageCount?: number; qty: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const currencySymbol = config?.currency_symbol || 'L';

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function addToCart(p: Product) {
    // OOS toast only when admin has disabled OOS orders.
    if (p.stock <= 0 && (config as any)?.allow_out_of_stock_orders === false) {
      const msg = (config as any)?.out_of_stock_message || 'Ky produkt nuk ka gjendje per momentin';
      showToast(msg);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, image: p.image, imageCount: p.imageCount, qty: 1 }];
    });
    showToast(`${p.name} u shtua ne shporte`);
  }
  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }
  function updateQty(id: number, qty: number) {
    if (qty < 1) return removeFromCart(id);
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  }
  async function toggleFavorite(productId: number) {
    const nowFavorite = await toggleFavoriteStorage(productId);
    showToast(nowFavorite ? 'Shtuar ne te preferuarat' : 'Hequr nga te preferuarat');
  }

  // Load config + favorites
  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config')
      .then(d => { if (d.success) setConfig(d.config); })
      .catch(() => {});

    fetchFavoritesFromDB().then(() => {
      setFavoriteIds(new Set<number>(getFavorites()));
    });
    const unsub = onFavoritesChanged(() => {
      setFavoriteIds(new Set<number>(getFavorites()));
    });
    return unsub;
  }, []);

  // Fetch only-offer products
  useEffect(() => {
    setLoading(true);
    fetch('/api/products?onlyOffers=true&limit=200&page=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.success) setProducts(d.products); })
      .catch(err => console.error('Failed to fetch deals:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config as any} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#FEE2E2' }}
          >
            <Tag size={20} className="text-red-600" />
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Oferta</h1>
        </div>
        <p className="text-gray-600 mb-8">
          Te gjitha produktet me oferte aktive — kursime te garantuara per ju.
        </p>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Duke ngarkuar...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg text-gray-500 mb-2">Asnje oferte aktive per momentin.</p>
            <p className="text-sm text-gray-400">Kthehuni se shpejti — ofertat shtohen vazhdimisht.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product as any}
                onAdd={addToCart}
                config={config as any}
                isFavorite={favoriteIds.has(product.id)}
                onToggleFavorite={toggleFavorite}
                isInCart={cart.some((i) => i.id === product.id)}
                onCartOpen={() => setCartOpen(true)}
              />
            ))}
          </div>
        )}
      </div>

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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
