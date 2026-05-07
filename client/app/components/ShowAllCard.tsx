"use client";

import Link from "next/link";

/**
 * Card tile that replaces the "Te gjitha" / "Shiko te gjitha" button at the
 * end of a product row. Visually mirrors the Kazidomi "Te gjitha produktet"
 * tile — same dimensions and rounded shadow as a ProductCard so it slots
 * cleanly into the grid as the last cell.
 */
export default function ShowAllCard({
  href,
  label = 'Te gjitha produktet',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition flex items-center justify-center text-center p-6 min-h-[16rem] sm:min-h-[20rem] md:min-h-[22rem] cursor-pointer group"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.03) 1px, transparent 1px)',
        backgroundSize: '12px 12px',
      }}
    >
      <span className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight opacity-60 group-hover:opacity-100 group-hover:underline transition">
        {label}
      </span>
    </Link>
  );
}
