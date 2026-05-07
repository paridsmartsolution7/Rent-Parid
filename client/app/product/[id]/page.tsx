"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Heart, ShoppingCart, Share2, Maximize2, Truck, MapPin } from "lucide-react";
import { isFavorite as isFavoriteStorage, toggleFavorite as toggleFavoriteStorage, onFavoritesChanged, fetchFavoritesFromDB, getFavorites } from "../../lib/favorites";
import { cachedFetch } from "../../lib/clientCache";
import { formatDate } from "../../lib/date";
import Navbar from "../../components/Navbar";
import CartDrawer from "../../components/CartDrawer";
import ProductCard from "../../components/ProductCardFixed";

type Product = {
  id: number;
  code: string;
  name: string;
  price: number;
  category: string;
  categoryName: string;
  image: string;
  imageCount?: number;
  description: string | null;
  longDescription: string | null;
  rating: number;
  reviewCount: number;
  stock: number;
  active: boolean;
  ofpiActive?: number;
  offerPrice?: number | string | null;
  offerStart?: string | null;
  offerEnd?: string | null;
  discountPercent?: number | string | null;
  unit?: string;
  magazina?: string;
  isNew?: number | boolean;
  isBestseller?: number | boolean;
};

type Suggestion = {
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
  isNew?: number | boolean;
  isBestseller?: number | boolean;
};

type Config = {
  company_name: string;
  navbar_color: string;
  primary_color: string;
  secondary_color: string;
  cart_button_text: string;
  currency_symbol: string;
  show_stock_count?: boolean;
  allow_out_of_stock_orders?: boolean;
  out_of_stock_message?: string | null;
  // Buttons + layout
  show_share_button?: boolean;
  show_favorite_button?: boolean;
  show_zoom_button?: boolean;
  images_layout?: 'row' | 'column' | string;
  price_currency_position?: 'before' | 'after' | string;
  // Delivery info card
  show_delivery_info?: boolean;
  delivery_estimate_text?: string | null;
  delivery_pickup_fee?: string | null;
  delivery_pickup_label?: string | null;
  delivery_shipping_fee?: string | null;
};

/** Renders a price with the currency word ("Lek") rendered smaller + grey +
    spaced from the number, on the configured side. Optional unit label
    on a separate line ("Njesia: cop"). Decimals render inline at the same
    size as the integer part — never as superscript. */
function PriceDisplay({
  amount,
  currency,
  position,
  unit,
  className,
  unitClassName,
}: {
  amount: number;
  currency: string;
  position: 'before' | 'after' | string;
  unit?: string | null;
  className?: string;
  decimalsClassName?: string;
  unitClassName?: string;
}) {
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const hasDecimals = decPart !== '00';
  const formatted = hasDecimals ? `${intPart}.${decPart}` : intPart;
  // Currency: smaller, grey, spaced — independent of the price's className.
  const currencyEl = (
    <span className="text-sm sm:text-base font-medium text-gray-500">
      {currency}
    </span>
  );
  return (
    <span className="inline-flex flex-col items-start">
      <span className={`${className} inline-flex items-baseline gap-1.5`}>
        {position === 'before' ? (
          <>{currencyEl}<span>{formatted}</span></>
        ) : (
          <><span>{formatted}</span>{currencyEl}</>
        )}
      </span>
      {unit && unit.trim() && (
        <span className={unitClassName}>Njesia: {unit}</span>
      )}
    </span>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [cart, setCart] = useState<{ id: number; name: string; price: number; image: string; imageCount?: number; qty: number }[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);
  const [cartOpen, setCartOpen] = useState(false);
  const [reviews, setReviews] = useState<{ id: number; rating: number; reviewText: string; createdAt: string; userName: string }[]>([]);
  const [comments, setComments] = useState<{ id: number; commentText: string; createdAt: string; userName: string }[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [newComment, setNewComment] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [showMoreDescription, setShowMoreDescription] = useState(false);
  // Per-article + global block state from /api/config/flags
  const [commentsBlocked, setCommentsBlocked] = useState(false);
  const [reviewsBlocked, setReviewsBlocked] = useState(false);
  const [deliveryBlocked, setDeliveryBlocked] = useState(false);
  const [blockMsg, setBlockMsg] = useState({
    comments: 'Komentet per kete artikull jane te bllokuara',
    reviews: 'Vleresimet per kete artikull jane te bllokuara',
  });

  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch {}
  }, [cart]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function updateQty(id: number, qty: number) {
    if (qty < 1) return removeFromCart(id);
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty } : i));
  }

  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config')
      .then(data => {
        if (data.success) setConfig(data.config);
      })
      .catch(err => console.error('Failed to fetch config:', err));

  }, []);

  // Resolve comment/review block status (global flag OR per-article override)
  useEffect(() => {
    if (!productId) return;
    fetch(`/api/config/flags?productId=${productId}`)
      .then(r => r.json())
      .then(d => {
        if (!d?.success) return;
        const cb = !d.flags?.comments_enabled || !!d.article?.comments_blocked;
        const rb = !d.flags?.reviews_enabled || !!d.article?.reviews_blocked;
        const db = !!d.article?.delivery_blocked;
        setCommentsBlocked(cb);
        setReviewsBlocked(rb);
        setDeliveryBlocked(db);
        if (d.messages) {
          setBlockMsg({
            comments: d.messages.comments_blocked || blockMsg.comments,
            reviews: d.messages.reviews_blocked || blockMsg.reviews,
          });
        }
      })
      .catch(() => {/* leave defaults */});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (data.success) {
          setProduct(data.product);
        }
      } catch (err) {
        console.error("Failed to fetch product:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProduct();
  }, [productId]);

  useEffect(() => {
    // Fetch favorites from database to sync state
    fetchFavoritesFromDB().then(() => {
      setIsFavorite(isFavoriteStorage(parseInt(productId)));
      setFavoriteIds(new Set<number>(getFavorites()));
    });

    const unsubscribe = onFavoritesChanged(() => {
      setIsFavorite(isFavoriteStorage(parseInt(productId)));
      setFavoriteIds(new Set<number>(getFavorites()));
    });
    return unsubscribe;
  }, [productId]);

  const addToCartSuggestion = useCallback((p: Suggestion) => {
    // OOS toast only when admin has disabled OOS orders. config is captured
    // by closure — reads the latest value from the latest render.
    if (p.stock <= 0 && config?.allow_out_of_stock_orders === false) {
      const msg = config?.out_of_stock_message || 'Ky produkt nuk ka gjendje per momentin';
      showToast(msg);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      if (existing) return prev.map((i) => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: p.price, image: p.image, imageCount: p.imageCount, qty: 1 }];
    });
    showToast(`${p.name} u shtua ne shporte`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const toggleFavoriteById = useCallback(async (id: number) => {
    const nowFavorite = await toggleFavoriteStorage(id);
    showToast(nowFavorite ? 'Shtuar ne te preferuarat' : 'Hequr nga te preferuarat');
  }, []);

  function toggleFavorite() {
    toggleFavoriteStorage(parseInt(productId)).then(nowFavorite => {
      setIsFavorite(nowFavorite);
      showToast(nowFavorite ? "Shtuar ne te preferuarat" : "Hequr nga te preferuarat");
    });
  }

  useEffect(() => {
    if (!product?.category) return;
    async function fetchSuggestions() {
      try {
        const params = new URLSearchParams({
          category: product!.category,
          limit: '12',
        });
        const res = await fetch(`/api/products?${params}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          const items: Suggestion[] = (data.products || [])
            .filter((p: Suggestion) => p.id !== parseInt(productId))
            .slice(0, 8);
          setSuggestions(items);
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
      }
    }
    fetchSuggestions();
  }, [product?.category, productId]);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/reviews?productId=${productId}`).then(r => r.json()).then(d => {
      if (d.success) setReviews(d.reviews);
    }).catch(() => {});
    fetch(`/api/comments?productId=${productId}`).then(r => r.json()).then(d => {
      if (d.success) setComments(d.comments);
    }).catch(() => {});
  }, [productId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function submitReview() {
    setReviewLoading(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ productId: parseInt(productId), rating: newRating, reviewText: newReviewText }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Vleresimi u ruajt');
        setNewReviewText('');
        // Refetch
        const r = await fetch(`/api/reviews?productId=${productId}`).then(r => r.json());
        if (r.success) setReviews(r.reviews);
      } else showToast(data.message || 'Deshtoi');
    } catch { showToast('Deshtoi'); }
    finally { setReviewLoading(false); }
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ productId: parseInt(productId), commentText: newComment }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Komenti u shtua');
        setNewComment('');
        const c = await fetch(`/api/comments?productId=${productId}`).then(r => r.json());
        if (c.success) setComments(c.comments);
      } else showToast(data.message || 'Deshtoi');
    } catch { showToast('Deshtoi'); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Duke ngarkuar...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-4">Produkti nuk u gjet</div>
          <button
            onClick={() => router.push('/')}
            className="text-[#1F3E76] hover:underline"
          >
            Kthehu ne Kryefaqje
          </button>
        </div>
      </div>
    );
  }

  const currencySymbol = config?.currency_symbol || 'L';
  const primaryColor = '#1F3E76';

  const hasOffer = (() => {
    if (!product.ofpiActive || !product.offerPrice) return false;
    const now = new Date();
    if (product.offerStart && new Date(product.offerStart) > now) return false;
    if (product.offerEnd && new Date(product.offerEnd) < now) return false;
    return true;
  })();
  const offerPrice = hasOffer ? Number(product.offerPrice) : 0;
  const discount = hasOffer && product.discountPercent ? Number(product.discountPercent) : 0;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={cartCount} onCartOpen={() => setCartOpen(true)} />

      {/* Floating back button (stays below the cart sidebar z-50) */}
      <button
        onClick={() => router.back()}
        aria-label="Kthehu prapa"
        className="fixed bottom-6 left-6 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-white text-[#1F3E76] shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      {/* Product Detail */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Top: Image left + Info right */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 p-4 md:p-8">
            <ProductImages
              product={product}
              layout={config?.images_layout === 'column' ? 'column' : 'row'}
              showZoom={config?.show_zoom_button !== false}
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium uppercase tracking-wide mb-2" style={{ color: primaryColor }}>{product.categoryName}</span>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {hasOffer && discount > 0 && (
                  <span className="bg-red-500 text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                    -{discount}% Zbritje
                  </span>
                )}
                {Number(product.isNew) === 1 && (
                  <span className="bg-[#1F3E76] text-white text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                    I ri
                  </span>
                )}
                {Number(product.isBestseller) === 1 && (
                  <span className="bg-purple-100 text-purple-700 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    Bestseller
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400 text-lg">{"★".repeat(Math.round(product.rating))}</span>
                  <span className="text-gray-400">{"★".repeat(5 - Math.round(product.rating))}</span>
                </div>
                <span className="text-sm text-gray-500">({product.reviewCount} vleresime)</span>
              </div>
              <div className="mb-6 flex items-start gap-3 flex-wrap">
                {(() => {
                  const pos = (config?.price_currency_position || 'after') as 'before' | 'after';
                  const bigClass = 'text-3xl sm:text-4xl md:text-5xl font-bold leading-none';
                  const supClass = 'text-base sm:text-lg md:text-xl font-semibold align-top ml-0.5';
                  const unitClass = 'text-xs text-gray-500 mt-1';
                  return hasOffer ? (
                    <>
                      <PriceDisplay
                        amount={offerPrice}
                        currency={currencySymbol}
                        position={pos}
                        unit={product.unit}
                        className={`${bigClass} text-red-600`}
                        decimalsClassName={`${supClass} text-red-600`}
                        unitClassName={unitClass}
                      />
                      <span className="text-lg sm:text-xl text-gray-400 line-through">
                        {pos === 'before'
                          ? `${currencySymbol}${product.price.toFixed(2)}`
                          : `${product.price.toFixed(2)}${currencySymbol}`}
                      </span>
                      {discount > 0 && <span className="bg-red-100 text-red-600 text-sm font-semibold px-2 py-0.5 rounded-full">-{discount}%</span>}
                    </>
                  ) : (
                    <PriceDisplay
                      amount={product.price}
                      currency={currencySymbol}
                      position={pos}
                      unit={product.unit}
                      className={`${bigClass} text-gray-900`}
                      decimalsClassName={`${supClass} text-gray-900`}
                      unitClassName={unitClass}
                    />
                  );
                })()}
              </div>

              {/* Delivery info card — shown when global toggle is on AND not
                  blocked per-article. Any field can be left empty in admin. */}
              {config?.show_delivery_info !== false && !deliveryBlocked && (
                config?.delivery_estimate_text || config?.delivery_pickup_fee || config?.delivery_shipping_fee
              ) ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 space-y-1.5">
                  {config?.delivery_estimate_text && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Truck size={16} className="text-gray-500 shrink-0" />
                      <span>Delivery <strong>{config.delivery_estimate_text}</strong></span>
                    </div>
                  )}
                  {(config?.delivery_pickup_fee || config?.delivery_shipping_fee) && (
                    <div className="flex items-start gap-2 text-sm text-gray-700">
                      <MapPin size={16} className="text-gray-500 shrink-0 mt-0.5" />
                      <span>
                        {config?.delivery_pickup_fee && (
                          <>
                            <strong>{config.delivery_pickup_fee}</strong>
                            {config?.delivery_pickup_label ? ` ${config.delivery_pickup_label}` : ''}
                          </>
                        )}
                        {config?.delivery_pickup_fee && config?.delivery_shipping_fee && (
                          <span className="text-gray-500"> ose </span>
                        )}
                        {config?.delivery_shipping_fee && (
                          <>
                            <strong>{config.delivery_shipping_fee}</strong>
                            <span className="text-gray-500"> shipping cost</span>
                          </>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
              {product.description && product.description.trim() && (
                <p className="text-gray-600 mb-4 leading-relaxed whitespace-pre-line">{product.description}</p>
              )}
              {product.longDescription && product.longDescription.trim() && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setShowMoreDescription(v => !v)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F3E76] hover:underline"
                    aria-expanded={showMoreDescription}
                  >
                    {showMoreDescription ? 'Me pak pershkrim' : 'Me shume pershkrim'}
                    <ChevronDown
                      size={14}
                      strokeWidth={2.5}
                      className={`transition-transform ${showMoreDescription ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {showMoreDescription && (
                    <p className="mt-3 text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                      {product.longDescription}
                    </p>
                  )}
                </div>
              )}
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Kodi i produktit: {product.code}</p>
                {/* The "Gjendje: …" line is admin-controlled. When the
                    "Shfaq gjendjen (sasine) e artikujve" toggle is off, hide
                    the whole line — including the "Nuk ka gjendje" red text.
                    When the toggle is on, show the numeric count when in
                    stock and the red message when out of stock. */}
                {config?.show_stock_count !== false && (
                  product.stock > 0 ? (
                    <p className="text-sm text-gray-500">
                      Gjendje:{' '}
                      <span className="text-blue-600 font-medium">
                        {`${product.stock} ne gjendje`}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Gjendje: <span className="text-red-600 font-medium">Nuk ka gjendje</span>
                    </p>
                  )
                )}
              </div>
              {/* When stock=0 AND admin disables OOS orders, show the configured message
                  inline above the button so the customer understands why it's disabled. */}
              {product.stock <= 0 && config?.allow_out_of_stock_orders === false && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2 text-sm">
                  {config?.out_of_stock_message || 'Ky produkt nuk ka gjendje per momentin'}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                {(() => {
                  const oos = product.stock <= 0;
                  const ordersBlocked = oos && config?.allow_out_of_stock_orders === false;
                  const oosMsg = config?.out_of_stock_message || 'Ky produkt nuk ka gjendje per momentin';
                  const dimmed = ordersBlocked ? 'opacity-40 cursor-not-allowed' : '';
                  return (
                    <button
                      aria-disabled={ordersBlocked}
                      disabled={ordersBlocked}
                      className={`flex-1 text-white px-6 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center justify-center gap-2 ${dimmed}`}
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, #1F3E76)` }}
                      onClick={() => {
                        if (ordersBlocked) {
                          showToast(oosMsg);
                          return;
                        }
                        setCart((prev) => {
                          const existing = prev.find((i) => i.id === product.id);
                          if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
                          return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, imageCount: product.imageCount, qty: 1 }];
                        });
                        showToast('U shtua ne shporte!');
                      }}
                    >
                      {ordersBlocked ? (
                        oosMsg
                      ) : (
                        <>
                          <span>Shto ne Shporte</span>
                          <ShoppingCart size={16} strokeWidth={2.5} />
                        </>
                      )}
                    </button>
                  );
                })()}
                {config?.show_favorite_button !== false && (
                  <button
                    onClick={toggleFavorite}
                    className="px-6 py-3 border-2 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg flex items-center gap-2"
                    style={{ borderColor: isFavorite ? '#ef4444' : '#D1D5DB', color: isFavorite ? '#ef4444' : '#6B7280', background: isFavorite ? '#fef2f2' : 'white' }}
                  >
                    <Heart size={20} fill={isFavorite ? '#ef4444' : 'none'} color={isFavorite ? '#ef4444' : '#6B7280'} />
                    {isFavorite ? "E preferuar" : "Prefero"}
                  </button>
                )}
                {config?.show_share_button !== false && (
                  <button
                    onClick={async () => {
                      const url = typeof window !== 'undefined' ? window.location.href : '';
                      try {
                        if (typeof navigator !== 'undefined' && (navigator as any).share) {
                          await (navigator as any).share({ title: product.name, url });
                        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          await navigator.clipboard.writeText(url);
                          showToast('Linku u kopjua!');
                        }
                      } catch {/* user cancelled */}
                    }}
                    className="px-4 py-3 border-2 border-gray-200 rounded-full font-semibold text-gray-600 hover:bg-gray-50 transition flex items-center gap-2"
                    aria-label="Share"
                  >
                    <Share2 size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mx-4 md:mx-8" />

          {/* Reviews + Comments below, inside same card */}
          <div className="p-4 md:p-8">
            {/* Reviews Section */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Vleresimet</h2>

              {/* Add review form (or blocked notice) */}
              {reviewsBlocked ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-6 text-sm">
                  {blockMsg.reviews}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Shkruani vleresimin tuaj</h3>
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setNewRating(star)} className="text-2xl">
                        <span className={star <= newRating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newReviewText}
                    onChange={e => setNewReviewText(e.target.value)}
                    placeholder="Shkruani pershtypjen tuaj per kete produkt..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76] resize-none"
                    rows={3}
                  />
                  <button
                    onClick={submitReview}
                    disabled={reviewLoading}
                    className="mt-2 text-white text-sm font-semibold px-5 py-2 rounded-full transition disabled:opacity-50"
                    style={{ backgroundColor: '#1F3E76' }}
                  >
                    {reviewLoading ? 'Duke ruajtur...' : 'Dergo vleresimin'}
                  </button>
                </div>
              )}

              {/* Review list */}
              {reviews.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Asnje vleresim ende. Beni te parin!</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 text-sm">{r.userName}</span>
                          <span className="text-yellow-400 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                      </div>
                      {r.reviewText && <p className="text-sm text-gray-600">{r.reviewText}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-gray-200 my-8" />

              {/* Comments Section */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Komentet</h2>

              {/* Add comment form (or blocked notice) */}
              {commentsBlocked ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-6 text-sm">
                  {blockMsg.comments}
                </div>
              ) : (
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitComment()}
                    placeholder="Shkruani nje koment..."
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  />
                  <button
                    onClick={submitComment}
                    className="text-white text-sm font-semibold px-5 py-2 rounded-full transition"
                    style={{ backgroundColor: '#1F3E76' }}
                  >
                    Dergo
                  </button>
                </div>
              )}

              {/* Comments list */}
              {comments.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Asnje koment ende.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="bg-gray-50 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900 text-sm">{c.userName}</span>
                        <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700">{c.commentText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        {/* Suggestions Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm p-4 md:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Me shume nga {product.categoryName}
          </h2>

          {suggestions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nuk ka produkte te tjera ne kete grup.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {suggestions.map(s => (
                <ProductCard
                  key={s.id}
                  product={s}
                  onAdd={addToCartSuggestion}
                  config={config ? { currency_symbol: config.currency_symbol, primary_color: config.primary_color, show_stock_warning: true } : null}
                  isFavorite={favoriteIds.has(s.id)}
                  onToggleFavorite={toggleFavoriteById}
                  isInCart={cart.some(i => i.id === s.id)}
                  onCartOpen={() => setCartOpen(true)}
                  compact
                />
              ))}
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

function ProductImages({
  product,
  layout = 'row',
  showZoom = true,
}: {
  product: Product;
  layout?: 'row' | 'column';
  showZoom?: boolean;
}) {
  const count = product.imageCount ?? 0;
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowRight' && count > 1) setIndex(i => (i + 1) % count);
      else if (e.key === 'ArrowLeft' && count > 1) setIndex(i => (i - 1 + count) % count);
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, count]);

  if (count === 0) {
    return (
      <div className="relative bg-gray-50 rounded-xl flex items-center justify-center h-56 sm:h-72 md:h-96 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-removed-background.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="w-1/2 h-1/2 object-contain opacity-40 pointer-events-none select-none"
        />
      </div>
    );
  }

  const indices = Array.from({ length: count }, (_, i) => i);
  const imgUrl = (i: number) => `/api/products/${product.id}/image?i=${i}&v=2`;

  // Main image area used by both layouts.
  const mainImage = (
    <div className="relative bg-gray-50 rounded-xl flex items-center justify-center h-56 sm:h-72 md:h-96 overflow-hidden flex-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl(index)}
        alt={product.name}
        className={`w-full h-full object-contain ${showZoom ? 'cursor-zoom-in' : ''}`}
        onClick={() => { if (showZoom) setLightboxOpen(true); }}
      />
      {showZoom && (
        <button
          onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow text-gray-700 flex items-center justify-center"
          aria-label="Zmadho"
        >
          <Maximize2 size={16} />
        </button>
      )}
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + count) % count); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow text-gray-700 flex items-center justify-center"
            aria-label="Foto e meparshme"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % count); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow text-gray-700 flex items-center justify-center"
            aria-label="Foto tjeter"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {indices.map(i => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                className={`w-2 h-2 rounded-full transition ${i === index ? 'bg-[#1F3E76] w-6' : 'bg-gray-400/60'}`}
                aria-label={`Shko te foto ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );

  const ThumbButton = ({ i, dim }: { i: number; dim: string }) => (
    <button
      key={i}
      onClick={() => setIndex(i)}
      className={`${dim} rounded-lg border-2 overflow-hidden transition ${i === index ? 'border-[#1F3E76]' : 'border-gray-200 hover:border-gray-300'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl(i)}
        alt={`${product.name} ${i + 1}`}
        className="w-full h-full object-contain bg-gray-50"
      />
    </button>
  );

  if (layout === 'column') {
    // Vertical thumbnail strip on the left, main image filling the rest.
    return (
      <div>
        <div className="flex gap-3">
          {count > 1 && (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
              {indices.map(i => (
                <ThumbButton key={i} i={i} dim="w-16 h-16 sm:w-20 sm:h-20 shrink-0" />
              ))}
            </div>
          )}
          {mainImage}
        </div>
      </div>
    );
  }

  // Default: horizontal thumbnail strip below the main image.
  return (
    <div>
      {mainImage}
      {count > 1 && (
        <div className="flex gap-2 mt-3">
          {indices.map(i => (
            <ThumbButton key={i} i={i} dim="w-14 h-14 sm:w-20 sm:h-20" />
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center"
            aria-label="Mbyll"
          >
            ✕
          </button>
          {count > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + count) % count); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-3xl flex items-center justify-center"
                aria-label="Foto e meparshme"
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % count); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-3xl flex items-center justify-center"
                aria-label="Foto tjeter"
              >
                ›
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl(index)}
            alt={product.name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {count > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {index + 1} / {count}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
