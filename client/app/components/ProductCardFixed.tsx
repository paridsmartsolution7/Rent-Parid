import Link from "next/link";
import { Users, Briefcase, Settings2 } from "lucide-react";
import HeartButton from "./HeartButton";
import { getCarSpecs } from "../lib/carSpecs";

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
  isNew?: number | boolean;
  isBestseller?: number | boolean;
};

type Config = {
  currency_symbol: string;
  primary_color: string;
  show_stock_warning: boolean;
  // Optional formatting prefs (read by the card so listing pages match the
  // product page automatically once admin flips them).
  price_currency_position?: 'before' | 'after' | string;
  show_favorite_button?: boolean;
};

function isOfferActive(product: Product): boolean {
  if (!product.ofpiActive || !product.offerPrice) return false;
  const now = new Date();
  if (product.offerStart && new Date(product.offerStart) > now) return false;
  if (product.offerEnd && new Date(product.offerEnd) < now) return false;
  return true;
}

/** Renders "500 Lek" or "Lek 500" depending on `position`. The currency
 *  word is rendered smaller + grey + spaced from the number, so the
 *  amount stays the dominant visual element (Kazidomi/Skroutz hierarchy).
 *  Decimals are inlined when they carry value — 100 stays "100", 100.50 → "100.50". */
function CardPrice({
  amount,
  currency,
  position,
  className,
}: {
  amount: number;
  currency: string;
  position: 'before' | 'after' | string;
  className?: string;
  decimalsClassName?: string;
}) {
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const hasDecimals = decPart !== '00';
  const formatted = hasDecimals ? `${intPart}.${decPart}` : intPart;
  const currencyEl = (
    <span className="text-xs sm:text-sm font-medium text-gray-500 ml-1">
      {currency}
    </span>
  );
  return position === 'before'
    ? <span className={`${className} inline-flex items-baseline`}><span className="text-xs sm:text-sm font-medium text-gray-500 mr-1">{currency}</span>{formatted}</span>
    : <span className={`${className} inline-flex items-baseline`}>{formatted}{currencyEl}</span>;
}

export default function ProductCard({
  product,
  onAdd,
  onRemoveFromCart,
  config,
  isFavorite,
  onToggleFavorite,
  isInCart,
  onCartOpen,
  compact = false,
}: {
  product: Product;
  onAdd: (p: Product) => void;
  /** When provided, the button toggles off when isInCart=true and the user
   *  clicks again — removing the item from the cart in-place. If omitted,
   *  the click falls back to opening the cart drawer (legacy behaviour). */
  onRemoveFromCart?: (id: number) => void;
  config: Config | null;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  isInCart?: boolean;
  onCartOpen?: () => void;
  compact?: boolean;
}) {
  const currencySymbol = config?.currency_symbol || 'L';
  const showStockWarning = config?.show_stock_warning !== false;
  const showFavoriteButton = config?.show_favorite_button !== false;
  const pricePosition = (config?.price_currency_position || 'after') as 'before' | 'after';

  const hasOffer = isOfferActive(product);
  const offerPrice = hasOffer ? Number(product.offerPrice) : 0;
  const discount = hasOffer && product.discountPercent ? Number(product.discountPercent) : 0;
  const oos = product.stock <= 0;
  const specs = getCarSpecs(product.id);

  return (
    <div className="bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden relative h-full">
      {/* Top-left badges: vehicle category (always) + offer/new/bestseller flags */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 items-start">
        <span className="bg-gray-900/85 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
          {specs.vehicleCategory}
        </span>
        {hasOffer && discount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
            -{discount}% Zbritje
          </span>
        )}
        {Number(product.isNew) === 1 && (
          <span className="bg-[#1F3E76] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
            Oferte e hershme
          </span>
        )}
        {Number(product.isBestseller) === 1 && (
          <span className="bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            Zgjedhja e dites
          </span>
        )}
      </div>

      {/* Heart top-right */}
      {showFavoriteButton && (
        <div className="absolute top-3 right-3 z-10">
          <HeartButton
            active={isFavorite}
            onClick={() => onToggleFavorite(product.id)}
          />
        </div>
      )}

      {/* Image area — the tenant logo always sits behind the product image as a
          faint watermark. Cards without a product photo show the logo as the
          only content (at higher opacity), so the placeholder stays on-brand. */}
      <Link
        href={`/product/${product.id}`}
        className="relative bg-gray-50 flex items-center justify-center h-56 sm:h-64 md:h-72 cursor-pointer overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-removed-background.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 m-auto w-1/2 h-1/2 object-contain pointer-events-none select-none ${(product.imageCount ?? 0) > 0 ? 'opacity-10' : 'opacity-40'}`}
        />
        {(product.imageCount ?? 0) > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/products/${product.id}/image`}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="relative w-full h-full object-contain p-1.5 sm:p-2"
          />
        )}
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {/* Title */}
        <Link
          href={`/product/${product.id}`}
          className="font-bold text-gray-900 text-base leading-snug mb-2 line-clamp-2 cursor-pointer min-h-[2.5rem]"
        >
          {product.name}
        </Link>

        {/* Price /DITË + crossed-out + estimated weekly total */}
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          {hasOffer ? (
            <>
              <span className="text-2xl sm:text-3xl font-extrabold text-red-600 leading-none">
                <CardPrice
                  amount={offerPrice}
                  currency={currencySymbol}
                  position={pricePosition}
                  decimalsClassName="text-xs sm:text-sm font-bold align-top ml-0.5"
                />
              </span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">/dite</span>
              <span className="text-sm text-gray-400 line-through">
                <CardPrice
                  amount={product.price}
                  currency={currencySymbol}
                  position={pricePosition}
                  decimalsClassName="text-[10px] align-top ml-0.5"
                />
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-none">
                <CardPrice
                  amount={product.price}
                  currency={currencySymbol}
                  position={pricePosition}
                  decimalsClassName="text-xs sm:text-sm font-bold align-top ml-0.5"
                />
              </span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">/dite</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-gray-500 mb-3">
          <span className="font-semibold">{((hasOffer ? offerPrice : product.price) * 7).toFixed(0)} {currencySymbol}</span> totali per 7 dite · 1500 km i perfshire
        </div>

        {/* Spec pills — passengers, suitcases, transmission */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[11px] font-semibold">
            <Users size={12} strokeWidth={2.5} />
            {specs.seats}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[11px] font-semibold">
            <Briefcase size={12} strokeWidth={2.5} />
            {specs.suitcases}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-[11px] font-semibold uppercase tracking-wider">
            <Settings2 size={12} strokeWidth={2.5} />
            {specs.transmission}
          </span>
        </div>

        <div className="mt-auto" />

        {oos ? (
          <button
            disabled
            aria-disabled
            className="w-full text-white text-sm font-semibold py-2.5 rounded-full shadow-sm inline-flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis opacity-40 cursor-not-allowed bg-gray-400"
          >
            E zene
          </button>
        ) : (
          <Link
            href={`/product/${product.id}`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
            className="w-full text-white text-sm font-semibold py-2.5 rounded-full shadow-sm inline-flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3E76] focus-visible:ring-offset-2 focus-visible:ring-offset-white bg-gray-900 hover:bg-[#1F3E76] transition-colors"
          >
            Rezervo tani
          </Link>
        )}

        {showStockWarning && product.stock <= 5 && product.stock > 0 && (
          <p className="text-xs text-orange-500 mt-1">Vetem {product.stock} te disponueshme!</p>
        )}
      </div>
    </div>
  );
}
