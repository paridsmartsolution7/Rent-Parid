"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function OrderConfirmedContent() {
  const params = useSearchParams();
  const router = useRouter();
  const status = params.get("status");
  const kodi = params.get("kodi");
  const total = params.get("total");
  const reason = params.get("reason");

  useEffect(() => {
    if (status === "ok") {
      try {
        localStorage.removeItem("cart");
        localStorage.removeItem("pendingCheckout");
      } catch {}
    }
  }, [status]);

  const isOk = status === "ok";
  const reasonMessages: Record<string, string> = {
    "missing-token": "Lidhja e konfirmimit nuk ka token.",
    "expired-or-invalid": "Kjo lidhje konfirmimi ka skaduar ose eshte e pavlefshme.",
    "bad-token": "Lidhja e konfirmimit eshte e gabuar.",
    "user-not-found": "Llogaria juaj nuk u gjet.",
    "product-unavailable": "Nje nga makinat nuk eshte me e disponueshme.",
    "db": "Ndodhi nje gabim gjate ruajtjes se rezervimit.",
    "server": "Ndodhi nje gabim ne server. Provoni perseri.",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        {isOk ? (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Rezervimi u Konfirmua</h1>
            <p className="text-gray-600 mb-4">
              Rezervimi juaj <b>#{kodi}</b> u vendos me sukses.
            </p>
            {total && (
              <p className="text-gray-900 font-semibold mb-6">Totali: ${total}</p>
            )}
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Rezervimi nuk mund te konfirmohet
            </h1>
            <p className="text-gray-600 mb-6">
              {reasonMessages[reason || ""] || "Something went wrong."}
            </p>
          </>
        )}
        <button
          onClick={() => router.push("/")}
          className="text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition"
          style={{ background: "linear-gradient(135deg, #1F3E76, #1F3E76)" }}
        >
          Kthehu ne Faqe
        </button>
      </div>
    </div>
  );
}

export default function OrderConfirmedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <OrderConfirmedContent />
    </Suspense>
  );
}
