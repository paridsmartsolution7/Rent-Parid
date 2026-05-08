"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProfileCompleteModal from "./ProfileCompleteModal";

type CartItem = {
  id: number;
  name: string;
  price: number;
  image: string;
  imageCount?: number;
  qty: number;
};

type CartDrawerProps = {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  currencySymbol: string;
  onClose: () => void;
  onUpdateQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  onCheckoutDone: (msg: string) => void;
  onClearCart: () => void;
};

type ProfileGap = {
  missing: { phone: boolean; address: boolean; city: boolean; postal_code: boolean };
  currentUser: { phone: string; address: string; city: string; postal_code: string };
};

export default function CartDrawer({ cart, cartCount, cartTotal, currencySymbol, onClose, onUpdateQty, onRemove, onCheckoutDone, onClearCart }: CartDrawerProps) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [profileGap, setProfileGap] = useState<ProfileGap | null>(null);

  async function runCheckout() {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: cart.map(i => ({ product_id: i.id, qty: i.qty, itemType: (i as any).itemType || 'AR' })),
          paymentMethod,
        }),
      });
      if (res.status === 401) {
        try {
          localStorage.setItem('pendingCheckout', '1');
          localStorage.setItem('returnAfterLogin', window.location.pathname);
        } catch {}
        onCheckoutDone("Ju lutem hyni per te vazhduar");
        onClose();
        router.push("/auth");
        return;
      }
      const data = await res.json();
      if (!data.success) {
        if (data.reason === 'incomplete-profile') {
          setProfileGap({ missing: data.missing, currentUser: data.currentUser });
          return;
        }
        onCheckoutDone(data.message || 'Rezervimi deshtoi');
        return;
      }
      onClearCart();
      onClose();
      onCheckoutDone('Konfirmoni rezervimin ne gmail');
    } catch (err) {
      console.error('Checkout error:', err);
      onCheckoutDone('Rezervimi deshtoi');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={onClose} />
        <div className="w-full sm:max-w-sm bg-white text-gray-900 h-full flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-lg font-bold">Rezervimi juaj ({cartCount})</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {cart.length === 0 ? (
              <p className="text-gray-600 text-center mt-10">Nuk keni asnje makine te rezervuar.</p>
            ) : (
              cart.map((item) => (
                /* min-w-0 + truncate inside lets the row collapse cleanly when
                   the product name is long; the qty + delete actions stay
                   pinned to the right. The thumbnail is a fixed 48×48 box —
                   when the product has no real image we fall back to the
                   tenant logo (NOT the barcode-as-text that was overflowing
                   the entire row). The barcode shows as a tiny subtitle
                   under the price. */
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
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {currencySymbol}{item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <button onClick={() => onUpdateQty(item.id, item.qty - 1)} className="w-7 h-7 rounded border border-gray-300 bg-white text-sm text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                    <button onClick={() => onUpdateQty(item.id, item.qty + 1)} className="w-7 h-7 rounded border border-gray-300 bg-white text-sm text-gray-900 hover:bg-gray-100 font-semibold flex items-center justify-center">+</button>
                  </div>
                  <button onClick={() => onRemove(item.id)} className="shrink-0 text-red-600 hover:text-red-700 text-lg" aria-label="Hiq">🗑</button>
                </div>
              ))
            )}
          </div>
          {cart.length > 0 && (
            <div className="px-5 py-4 border-t space-y-3">
              <div className="flex justify-between font-semibold text-lg">
                <span>Totali</span>
                <span>{currencySymbol}{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-3 mb-3">
                <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition ${paymentMethod === 'cash' ? 'border-[#1F3E76] bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="accent-[#1F3E76]" />
                  <span className="text-sm font-medium">Kesh</span>
                </label>
                <label className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition ${paymentMethod === 'card' ? 'border-[#1F3E76] bg-blue-50' : 'border-gray-200'}`}>
                  <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="accent-[#1F3E76]" />
                  <span className="text-sm font-medium">Karte</span>
                </label>
              </div>
              <button
                onClick={runCheckout}
                className="w-full bg-[#1F3E76] text-white py-3 rounded-full font-semibold hover:bg-[#1F3E76] transition"
              >
                Konfirmo rezervimin
              </button>
            </div>
          )}
        </div>
      </div>

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
    </>
  );
}
