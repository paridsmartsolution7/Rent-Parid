"use client";

import { Heart } from "lucide-react";

type Props = {
  active: boolean;
  onClick: () => void;
  size?: number;
  className?: string;
};

export default function HeartButton({ active, onClick, size = 22, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={active ? "Hiq nga te preferuarat" : "Shto ne te preferuarat"}
      aria-pressed={active}
      className={`w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-md hover:scale-110 transition ${className}`}
    >
      <Heart
        size={size}
        strokeWidth={2.5}
        fill={active ? "#ef4444" : "none"}
        color={active ? "#ef4444" : "#000000"}
        className="transition-colors"
      />
    </button>
  );
}
