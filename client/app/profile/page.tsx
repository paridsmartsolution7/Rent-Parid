"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Pencil, Check, ShoppingCart, ShoppingBag } from "lucide-react";
import Navbar from "../components/Navbar";
import { cachedFetch } from "../lib/clientCache";
import { formatDate } from "../lib/date";
import CityAutocomplete from "../components/CityAutocomplete";

type OrderItem = {
  orderId: number;
  productId: number;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
  vat: number;
};

type Order = {
  id: number;
  kodi: number;
  data: string;
  total: number;
  currency: string;
  status: string;
  confirmed: number;
  billingInfo: string | null;
  shippingInfo: string | null;
  createdAt: string;
  items: OrderItem[];
};

type UserInfo = {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  klient_kodi: string | null;
  tip_cmimi: string | null;
  created_at: string;
};

type Config = {
  company_name: string;
  navbar_color: string;
  primary_color: string;
  secondary_color: string;
  cart_button_text: string;
  currency_symbol: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'info'>('orders');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '', city: '', postal_code: '' });

  const primaryColor = '#1F3E76';

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function showSuccess(msg: string) {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  }

  function startEditing() {
    if (!user) return;
    setEditForm({
      full_name: user.full_name || '',
      phone: user.phone || '',
      address: user.address || '',
      city: user.city || '',
      postal_code: user.postal_code || '',
    });
    setEditing(true);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setUser(prev => prev ? { ...prev, ...editForm } : prev);
        setEditing(false);
        showToast('Profili u perditesua me sukses');
      } else {
        showToast(data.message || 'Perditesimi deshtoi');
      }
    } catch {
      showToast('Perditesimi deshtoi');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    cachedFetch<{ success: boolean; config: Config }>('/api/config')
      .then(data => { if (data.success) setConfig(data.config); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const confirmedSeen = new Set<number>();
    let initialized = false;

    async function fetchOrders(silent: boolean) {
      try {
        const res = await fetch('/api/user/orders', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.success) return;

        const nextOrders: Order[] = data.orders || [];

        if (initialized) {
          const newlyConfirmed = nextOrders.filter(
            o => Boolean(o.confirmed) && !confirmedSeen.has(o.id)
          );
          if (newlyConfirmed.length > 0 && !silent) {
            const kodi = newlyConfirmed[0].kodi;
            showSuccess(`Porosia #${kodi} u konfirmua me sukses! 🎉`);
          }
        }

        for (const o of nextOrders) {
          if (o.confirmed) confirmedSeen.add(o.id);
        }
        initialized = true;
        setOrders(nextOrders);
      } catch {
        // ignore transient errors; next tick will retry
      }
    }

    async function fetchInitial() {
      setLoading(true);
      try {
        const userRes = await fetch('/api/auth/me', { credentials: 'include' });
        const userData = await userRes.json();
        if (cancelled) return;
        if (!userData.success) {
          router.push('/auth');
          return;
        }
        setUser(userData.user);
        await fetchOrders(true);
      } catch (err) {
        console.error('Failed to fetch profile data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInitial();

    // Poll every 10s so newly-confirmed orders appear without a full reload
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchOrders(false);
    }, 10000);

    // Refresh instantly when the tab regains focus (covers clicking the email link in another tab)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchOrders(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router]);

  const currencySymbol = config?.currency_symbol || 'L';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar config={config} cartCount={0} onCartOpen={() => {}} />
        <div className="flex items-center justify-center py-32">
          <div className="text-gray-400 text-lg">Duke ngarkuar...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={0} onCartOpen={() => {}} />

      {/* Header */}
      <div
        className="text-white py-12 px-4"
        style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryColor})` }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            {user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{user.full_name}</h1>
            <p className="text-blue-100 text-sm">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex border-b border-gray-200 mt-4">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${
              activeTab === 'orders'
                ? 'border-[#1F3E76] text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Porosite e mia
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`px-5 py-3 text-sm font-semibold transition border-b-2 ${
              activeTab === 'info'
                ? 'border-[#1F3E76] text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Informacioni im
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'orders' ? (
          /* Orders Tab */
          orders.length === 0 ? (
            <div className="text-center py-16">
              <div className="mb-4 flex justify-center">
                <ShoppingCart size={56} strokeWidth={1.5} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg mb-4">Nuk keni bere asnje porosi ende</p>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-full transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Fillo Blerjet</span>
                <ShoppingBag size={18} strokeWidth={2.5} />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* Order header */}
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">Porosia #{order.kodi}</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(order.data, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        order.confirmed
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {order.confirmed ? 'Konfirmuar' : 'Ne pritje'}
                      </span>
                      <span className="font-bold text-gray-900">{currencySymbol}{Number(order.total).toFixed(2)}</span>
                      <ChevronDown
                        size={18}
                        className={`text-gray-400 transition-transform duration-200 ${expandedOrder === order.id ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Order details (expanded) */}
                  {expandedOrder === order.id && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase tracking-wider">
                            <th className="text-left pb-2 font-medium">Produkti</th>
                            <th className="text-center pb-2 font-medium">Sasia</th>
                            <th className="text-right pb-2 font-medium">Cmimi</th>
                            <th className="text-right pb-2 font-medium">Totali</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => (
                            <tr key={idx} className="border-t border-gray-50">
                              <td className="py-2.5 text-gray-800">
                                <Link href={`/product/${item.productId}`} className="hover:underline hover:text-[#1F3E76]">
                                  {item.name}
                                </Link>
                              </td>
                              <td className="py-2.5 text-center text-gray-600">x{item.qty}</td>
                              <td className="py-2.5 text-right text-gray-600">{currencySymbol}{Number(item.price).toFixed(2)}</td>
                              <td className="py-2.5 text-right font-semibold text-gray-900">{currencySymbol}{Number(item.lineTotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-gray-200">
                            <td colSpan={3} className="py-3 text-right font-semibold text-gray-700">Totali:</td>
                            <td className="py-3 text-right font-bold text-lg" style={{ color: primaryColor }}>
                              {currencySymbol}{Number(order.total).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          /* Info Tab */
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Informacioni im</h2>
              {!editing ? (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  <Pencil size={14} />
                  Ndrysho
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                  >
                    Anulo
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="text-sm font-medium px-4 py-1.5 rounded-lg text-white transition disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {saving ? 'Duke ruajtur...' : 'Ruaj'}
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Emri i plote *</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <p className="text-gray-400 text-sm py-2">{user.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Telefoni</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Qyteti</label>
                  <CityAutocomplete
                    value={editForm.city}
                    onChange={(v) => setEditForm(f => ({ ...f, city: v }))}
                    placeholder="Kerkoni ose shkruani qytetin..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Adresa</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Kodi Postar</label>
                  <input
                    type="text"
                    value={editForm.postal_code}
                    onChange={e => setEditForm(f => ({ ...f, postal_code: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Emri i plote</label>
                  <p className="text-gray-900 font-medium">{user.full_name}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                  <p className="text-gray-900 font-medium">{user.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Telefoni</label>
                  <p className="text-gray-900 font-medium">{user.phone || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Qyteti</label>
                  <p className="text-gray-900 font-medium">{user.city || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Adresa</label>
                  <p className="text-gray-900 font-medium">{user.address || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Kodi Postar</label>
                  <p className="text-gray-900 font-medium">{user.postal_code || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Kodi i Klientit</label>
                  <p className="text-gray-900 font-mono font-semibold tracking-wide">{user.klient_kodi || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tip Cmimi</label>
                  <p className="text-gray-900 font-mono font-semibold tracking-wide">{user.tip_cmimi || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Anetaresuar qe nga</label>
                  <p className="text-gray-900 font-medium">
                    {formatDate(user.created_at, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Success toast (order confirmed) */}
      {successToast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-blue-600 text-white px-5 py-3 rounded-full text-sm font-medium shadow-2xl z-[60] ring-2 ring-blue-400/50"
          role="status"
          aria-live="polite"
        >
          <Check size={20} strokeWidth={3} />
          {successToast}
        </div>
      )}
    </div>
  );
}
