"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { fetchFavoritesFromDB, removeFavorite as removeFavoriteStorage, onFavoritesChanged } from "../lib/favorites";
import { cachedFetch } from "../lib/clientCache";
import Navbar from "../components/Navbar";
import CartDrawer from "../components/CartDrawer";
import ProductCard from "../components/ProductCardFixed";

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

export default function FavoritesPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cart, setCart] = useState<{ id: number; name: string; price: number; image: string; imageCount?: number; qty: number }[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem('cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function removeFromCartFn(id: number) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQty(id: number, qty: number) {
    if (qty < 1) return removeFromCartFn(id);
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  }

  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config')
      .then(data => {
        if (data.success) setConfig(data.config);
      })
      .catch(err => console.error('Failed to fetch config:', err));
  }, []);

  useEffect(() => {
    async function fetchFavoriteProducts() {
      setLoading(true);
      try {
        const favoriteIds = await fetchFavoritesFromDB();
        console.log('Favorite IDs:', favoriteIds);

        if (favoriteIds.length === 0) {
          setProducts([]);
          setLoading(false);
          return;
        }

        const results = await Promise.all(
          favoriteIds.map(id =>
            fetch(`/api/products/${id}`, { cache: 'no-store' })
              .then(res => res.json())
              .then(data => {
                console.log(`Product ${id}:`, data);
                return data.success ? data.product : null;
              })
              .catch(err => {
                console.error(`Failed to fetch product ${id}:`, err);
                return null;
              })
          )
        );
        const validProducts = results.filter((p): p is Product => p !== null);
        console.log('Valid products:', validProducts);
        setProducts(validProducts);
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchFavoriteProducts();
    const unsubscribe = onFavoritesChanged(fetchFavoriteProducts);
    return unsubscribe;
  }, []);

  function removeFavorite(productId: number) {
    removeFavoriteStorage(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    showToast("Hequr nga te preferuarat");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const primaryColor = '#1F3E76';
  const secondaryColor = '#1F3E76';
  const currencySymbol = config?.currency_symbol || 'L';

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      {/* Hero */}
      <div
        className="text-white py-16 px-4 text-center"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`
        }}
      >
        <h1 className="text-4xl font-bold mb-3">Te preferuarat e mia</h1>
        <p className="text-blue-100 text-lg">Produktet e ruajtura</p>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-lg">Duke ngarkuar...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg mb-4">Nuk keni te preferuara ende</p>
            <button
              onClick={() => router.push('/shop')}
              className="inline-flex items-center gap-2 text-white px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
              }}
            >
              <span>Fillo Blerjet</span>
              <ShoppingBag size={18} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product as any}
                onAdd={(p) => {
                  setCart((prev) => {
                    const existing = prev.find((i) => i.id === p.id);
                    if (existing) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
                    return [...prev, { id: p.id, name: p.name, price: p.price, image: p.image, imageCount: p.imageCount, qty: 1 }];
                  });
                  showToast(`${product.name} u shtua ne shporte`);
                }}
                onRemoveFromCart={(id) => {
                  removeFromCartFn(id);
                  showToast('U hoq nga shporta');
                }}
                config={config as any}
                isFavorite={true}
                onToggleFavorite={() => removeFavorite(product.id)}
                isInCart={cart.some((c) => c.id === product.id)}
                onCartOpen={() => setCartOpen(true)}
              />
            ))}
          </div>
        )}
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
          onRemove={removeFromCartFn}
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
