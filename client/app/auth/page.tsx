"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, ChevronDown, X } from "lucide-react";
import { setStoredUser } from "../lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

type Config = {
  company_name: string;
  primary_color: string;
  secondary_color: string;
};

type SavedAccount = {
  email: string;
};

const REMEMBERED_KEY = "remembered_accounts";

function loadSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(REMEMBERED_KEY, JSON.stringify(accounts));
}

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const savedMenuRef = useRef<HTMLDivElement>(null);
  
  // Register form
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regPostalCode, setRegPostalCode] = useState("");

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.success) setConfig(data.config);
      })
      .catch(err => console.error('Failed to fetch config:', err));

    setSavedAccounts(loadSavedAccounts());
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (savedMenuRef.current && !savedMenuRef.current.contains(e.target as Node)) {
        setSavedOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pickSavedAccount(account: SavedAccount) {
    setLoginEmail(account.email);
    setRememberMe(true);
    setSavedOpen(false);
  }

  function removeSavedAccount(email: string) {
    const next = savedAccounts.filter((a) => a.email !== email);
    setSavedAccounts(next);
    persistSavedAccounts(next);
    if (next.length === 0) setSavedOpen(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();

      if (data.success) {
        if (data.user) {
          setStoredUser({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
          });
        }
        if (rememberMe) {
          const next = [
            { email: loginEmail },
            ...savedAccounts.filter((a) => a.email !== loginEmail),
          ];
          setSavedAccounts(next);
          persistSavedAccounts(next);
        }
        showToast("Hyrja u krye me sukses!");
        setRedirecting(true);
        const returnUrl = localStorage.getItem('returnAfterLogin') || '/';
        localStorage.removeItem('returnAfterLogin');
        setTimeout(() => router.push(returnUrl), 1000);
        return;
      } else {
        showToast(data.message || "Hyrja deshtoi");
      }
    } catch (err) {
      showToast("Hyrja deshtoi");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          full_name: regFullName,
          phone: regPhone,
          address: regAddress,
          city: regCity,
          postal_code: regPostalCode
        })
      });

      const data = await res.json();

      if (data.success) {
        if (data.needs_email_verification) {
          setPendingVerifyEmail(regEmail);
          setVerifyCode("");
          showToast("Derguam nje kod me 4 shifra ne email-in tuaj");
        } else {
          showToast("Regjistrimi u krye! Ju lutem hyni.");
          setIsLogin(true);
          setLoginEmail(regEmail);
        }
      } else {
        showToast(data.message || "Regjistrimi deshtoi");
      }
    } catch (err) {
      showToast("Regjistrimi deshtoi");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingVerifyEmail) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerifyEmail, code: verifyCode }),
      });
      const data = await res.json();
      if (data.success) {
        // Auto-login after verification — no need to re-enter credentials
        try {
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerifyEmail, password: regPassword }),
          });
          const loginData = await loginRes.json();
          if (loginData.success && loginData.user) {
            setStoredUser({
              id: loginData.user.id,
              email: loginData.user.email,
              full_name: loginData.user.full_name,
            });
            showToast("Regjistrimi u krye me sukses!");
            setRedirecting(true);
            setPendingVerifyEmail(null);
            setVerifyCode("");
            const returnUrl = localStorage.getItem('returnAfterLogin') || '/';
            localStorage.removeItem('returnAfterLogin');
            setTimeout(() => router.push(returnUrl), 1000);
            return;
          }
        } catch {
          // fall through to manual login
        }
        showToast("Email-i u verifikua! Ju lutem hyni.");
        setPendingVerifyEmail(null);
        setIsLogin(true);
        setLoginEmail(pendingVerifyEmail);
        setVerifyCode("");
      } else {
        showToast(data.message || "Verifikimi deshtoi");
      }
    } catch {
      showToast("Verifikimi deshtoi");
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleResponse = useCallback(async (response: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.user) {
          setStoredUser({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
          });
        }
        showToast("Hyrja u krye me sukses!");
        setRedirecting(true);
        const returnUrl = localStorage.getItem('returnAfterLogin') || '/';
        localStorage.removeItem('returnAfterLogin');
        setTimeout(() => router.push(returnUrl), 1000);
        return;
      } else {
        showToast(data.message || "Hyrja me Google deshtoi");
      }
    } catch {
      showToast("Hyrja me Google deshtoi");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const renderGoogleButton = useCallback(() => {
    if (window.google && googleBtnRef.current) {
      googleBtnRef.current.innerHTML = '';
      // iOS WebKit (Safari + Chrome on iOS) blocks third-party cookies on the
      // GSI iframe by default, which causes the popup-based ID-token flow to
      // fail with "origin_mismatch" or empty responses. itp_support enables
      // the ITP-friendly flow; use_fedcm_for_prompt switches to the modern
      // FedCM API where supported, both of which sidestep the cookie block.
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        itp_support: true,
        use_fedcm_for_prompt: true,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 350,
        text: 'continue_with',
      });
    }
  }, [handleGoogleResponse]);

  useEffect(() => {
    if (window.google) {
      renderGoogleButton();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => renderGoogleButton();
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, [renderGoogleButton]);

  // Re-render Google button when switching tabs
  useEffect(() => {
    renderGoogleButton();
  }, [isLogin, pendingVerifyEmail, renderGoogleButton]);

  const primaryColor = '#1F3E76';
  const secondaryColor = '#1F3E76';

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {redirecting && (
        <div className="fixed inset-0 z-[60] bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-12 h-12 rounded-full border-4 border-gray-200 animate-spin"
              style={{ borderTopColor: '#1F3E76' }}
            />
            <span className="text-sm font-medium text-gray-700">Duke ju ridrejtuar...</span>
          </div>
        </div>
      )}
      {/* Header — circular logo to the left, title + subtitle stacked beside */}
      <div
        className="text-white py-8 px-4"
        style={{
          background: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
        }}
      >
        <div className="max-w-md mx-auto flex flex-row items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/logo"
            alt={config?.company_name || 'Logo'}
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0 bg-white"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight truncate">
              {config?.company_name || 'PSS Shop'}
            </h1>
            <p className="text-blue-100 text-sm sm:text-base">
              Miresevini! Hyni ose krijoni nje llogari.
            </p>
          </div>
        </div>
      </div>

      {/* Auth Form */}
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white text-gray-900 rounded-2xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setIsLogin(true)}
              disabled={!!pendingVerifyEmail}
              className={`flex-1 py-3 text-sm font-medium transition ${
                isLogin ? 'border-b-2 text-gray-900' : 'text-gray-500'
              }`}
              style={{ borderColor: isLogin ? primaryColor : 'transparent' }}
            >
              Hyr
            </button>
            <button
              onClick={() => setIsLogin(false)}
              disabled={!!pendingVerifyEmail}
              className={`flex-1 py-3 text-sm font-medium transition ${
                !isLogin ? 'border-b-2 text-gray-900' : 'text-gray-500'
              }`}
              style={{ borderColor: !isLogin ? primaryColor : 'transparent' }}
            >
              Regjistrohu
            </button>
          </div>

          {/* Login Form */}
          {pendingVerifyEmail ? (
            <form onSubmit={handleVerifyEmail} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-700">
                  Shkruani kodin <span className="font-semibold">4-shifror</span> te derguar ne{" "}
                  <span className="font-semibold">{pendingVerifyEmail}</span>.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kodi i verifikimit</label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  autoComplete="one-time-code"
                  maxLength={4}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\\D/g, "").slice(0, 4))}
                  required
                  className="w-full tracking-[0.45em] text-center border border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="1234"
                />
              </div>
              <button
                type="submit"
                disabled={loading || verifyCode.length !== 4}
                className="w-full text-white py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                }}
              >
                {loading ? "Duke verifikuar..." : "Verifiko Email-in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingVerifyEmail(null);
                  setVerifyCode("");
                }}
                className="w-full text-gray-600 py-2 text-sm hover:underline"
              >
                Anulo
              </button>
            </form>
          ) : isLogin ? (
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {savedAccounts.length > 0 && (
                <div ref={savedMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSavedOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={savedOpen}
                    className="w-full flex items-center justify-between gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 transition"
                  >
                    <span className="flex items-center gap-2">
                      <User size={16} />
                      Perdor nje llogari te ruajtur ({savedAccounts.length})
                    </span>
                    <ChevronDown size={14} strokeWidth={2.5} />
                  </button>
                  {savedOpen && (
                    <div
                      role="menu"
                      className="absolute left-0 right-0 top-full mt-2 rounded-lg bg-white shadow-xl border border-gray-200 py-1 z-50 max-h-64 overflow-auto"
                    >
                      {savedAccounts.map((account) => (
                        <div
                          key={account.email}
                          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50"
                        >
                          <button
                            type="button"
                            onClick={() => pickSavedAccount(account)}
                            className="flex-1 text-left text-sm text-gray-800 truncate"
                          >
                            {account.email}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSavedAccount(account.email)}
                            aria-label={`Hiq ${account.email}`}
                            className="text-gray-400 hover:text-red-600 p-1 rounded"
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fjalekalimi</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="••••••••"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-[#1F3E76]"
                  style={{ accentColor: primaryColor }}
                />
                Me mbaj mend ne kete pajisje
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50 shadow-lg hover:shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                }}
              >
                {loading ? "Duke hyre..." : "Hyr"}
              </button>
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">ose</span></div>
              </div>
              <div ref={googleBtnRef} className="flex justify-center" />
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emri i plote *</label>
                <input
                  type="text"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="Emri Mbiemri"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fjalekalimi *</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefoni</label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="+355..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresa</label>
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                  placeholder="Rr. Kryesore 123"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qyteti</label>
                  <input
                    type="text"
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                    placeholder="Tirane"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kodi Postar</label>
                  <input
                    type="text"
                    value={regPostalCode}
                    onChange={(e) => setRegPostalCode(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                    placeholder="1001"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50 shadow-lg hover:shadow-xl"
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                }}
              >
                {loading ? "Duke krijuar llogarinë..." : "Krijo Llogarine"}
              </button>
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">ose</span></div>
              </div>
              <div ref={googleBtnRef} className="flex justify-center" />
            </form>
          )}

          {/* Kthehu ne Kryefaqje */}
          <div className="px-6 pb-6">
            <button
              onClick={() => router.push('/')}
              className="w-full text-gray-600 py-2 text-sm hover:underline"
            >
              Kthehu ne Kryefaqje
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-full text-sm shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
