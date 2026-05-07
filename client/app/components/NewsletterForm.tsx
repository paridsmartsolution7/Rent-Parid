"use client";

import { useState } from "react";

/**
 * Subscription form for the homepage newsletter card. Persists to
 * dbo.ecommerce_newsletter_subscribers via POST /api/newsletter/subscribe.
 * Whenever the admin publishes a new blog post, every active row in that
 * table (plus all registered shop users) gets emailed automatically.
 */
export default function NewsletterForm({
  primary,
  onToast,
}: {
  primary: string;
  onToast: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    try {
      const r = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.success) {
        onToast("Faleminderit! Do ju njoftojme per cdo postim te ri.");
        setEmail("");
      } else {
        onToast(d?.message || "Email-i nuk eshte i vlefshem.");
      }
    } catch {
      onToast("Lidhja deshtoi. Provo perseri.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto"
    >
      <input
        type="email"
        required
        placeholder="Email-i juaj"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
        className="flex-1 px-5 py-3 rounded-full text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-70"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-7 py-3 rounded-full font-bold bg-white hover:bg-gray-50 transition disabled:opacity-70"
        style={{ color: primary }}
      >
        {busy ? "Duke ruajtur..." : "Regjistrohu"}
      </button>
    </form>
  );
}
