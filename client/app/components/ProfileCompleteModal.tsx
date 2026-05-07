"use client";

import { useState } from "react";
import CityAutocomplete from "./CityAutocomplete";

type MissingFlags = {
  phone: boolean;
  address: boolean;
  city: boolean;
  postal_code: boolean;
};

type InitialValues = {
  phone: string;
  address: string;
  city: string;
  postal_code: string;
};

type Props = {
  missing: MissingFlags;
  initial: InitialValues;
  onCancel: () => void;
  onSaved: () => void;
};

export default function ProfileCompleteModal({ missing, initial, onCancel, onSaved }: Props) {
  const [phone, setPhone] = useState(initial.phone || "");
  const [address, setAddress] = useState(initial.address || "");
  const [city, setCity] = useState(initial.city || "");
  const [postalCode, setPostalCode] = useState(initial.postal_code || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trim = (v: string) => v.trim();
  const allFilled = !!(trim(phone) && trim(address) && trim(city) && trim(postalCode));

  async function save() {
    if (!allFilled) {
      setError("Plotesoni te gjitha fushat per te vazhduar");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone: trim(phone),
          address: trim(address),
          city: trim(city),
          postal_code: trim(postalCode),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Ruajtja deshtoi");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Ruajtja deshtoi");
      setSaving(false);
    }
  }

  const labelCls = (isMissing: boolean) =>
    `block text-xs font-semibold uppercase tracking-wider mb-1 ${
      isMissing ? "text-red-600" : "text-gray-500"
    }`;
  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Plotesoni te dhenat</h2>
          <p className="text-sm text-gray-600 mt-1">
            Per te perfunduar porosine, ju lutem plotesoni te dhenat e meposhtme.
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls(missing.phone)}>
              Telefoni {missing.phone && <span className="text-red-500">*</span>}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+355..."
              className={inputCls}
              autoFocus={missing.phone}
            />
          </div>

          <div>
            <label className={labelCls(missing.address)}>
              Adresa {missing.address && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rr. Kryesore 123"
              className={inputCls}
              autoFocus={!missing.phone && missing.address}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls(missing.city)}>
                Qyteti {missing.city && <span className="text-red-500">*</span>}
              </label>
              <CityAutocomplete
                value={city}
                onChange={setCity}
                placeholder="Kerkoni ose shkruani qytetin..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls(missing.postal_code)}>
                Kodi Postar {missing.postal_code && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="1001"
                className={inputCls}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition disabled:opacity-50"
          >
            Anulo
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !allFilled}
            className="flex-1 px-4 py-2.5 rounded-full bg-[#1F3E76] text-white text-sm font-semibold hover:bg-[#1F3E76] transition disabled:opacity-50"
          >
            {saving ? "Duke ruajtur..." : "Ruaj dhe vazhdo"}
          </button>
        </div>
      </div>
    </div>
  );
}
