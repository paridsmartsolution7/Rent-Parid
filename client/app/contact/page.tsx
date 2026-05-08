"use client";

import { useState } from "react";
import Link from "next/link";

const primaryColor = "#1F3E76";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Open mailto link with pre-filled data
    const subject = encodeURIComponent(`Mesazh nga ${name}`);
    const body = encodeURIComponent(`Emri: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:info@paridsmartsolution.al?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div
        className="text-white py-16 px-4 text-center"
        style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryColor})` }}
      >
        <h1 className="text-4xl font-bold mb-3">Na Kontaktoni</h1>
        <p className="text-blue-100 text-lg">Jemi ketu per cdo pyetje rreth qirase se makinave</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Informacioni i kontaktit</h2>
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Email</p>
                  <a href="mailto:info@paridsmartsolution.al" className="text-sm text-gray-600 hover:underline">info@paridsmartsolution.al</a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Telefon</p>
                  <div className="flex flex-col">
                    <a href="tel:+355686005016" className="text-sm text-gray-600 hover:underline">+355 68 600 5016</a>
                    <a href="tel:+355686005025" className="text-sm text-gray-600 hover:underline">+355 68 600 5025</a>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Adresa</p>
                  <a
                    href="https://www.google.com/maps/place/Parid+Smart+Solution/@41.318977,19.8146535,17z/data=!4m14!1m7!3m6!1s0x135031b04e8b72c3:0xf7f4a7a8e9cc57a5!2sParid+Smart+Solution!8m2!3d41.318973!4d19.8172284!16s%2Fg%2F11t5h4zxmx!3m5!1s0x135031b04e8b72c3:0xf7f4a7a8e9cc57a5!8m2!3d41.318973!4d19.8172284!16s%2Fg%2F11t5h4zxmx?entry=ttu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Rr. Abdyl Frasheri, Tirane
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {submitted ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Faleminderit!</h3>
                <p className="text-gray-600">Mesazhi juaj u dergua. Do t&apos;ju kontaktojme sa me shpejt.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Dergoni nje mesazh</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emri i plote</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                    placeholder="Emri juaj"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76]"
                    placeholder="email@shembull.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mesazhi</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F3E76] resize-none"
                    placeholder="Shkruani mesazhin tuaj ketu..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full text-white py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor})` }}
                >
                  Dergo mesazhin
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-10">
          <Link href="/" className="text-sm text-gray-500 hover:underline">
            Kthehu ne Kryefaqje
          </Link>
        </div>
      </div>
    </div>
  );
}
