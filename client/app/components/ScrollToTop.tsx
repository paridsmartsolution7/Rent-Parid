"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Kthehu lart"
      className="fixed bottom-6 right-6 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-[#1F3E76] text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
    >
      <ChevronUp size={20} strokeWidth={2.5} />
    </button>
  );
}
