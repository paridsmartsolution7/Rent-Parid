"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

const EXTERNAL_BLOG_BASE = "https://blog.pss.al:8001";

type ExternalPost = {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  featured_image?: string | null;
  PublishDate?: string | null;
  published_at?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
};

/**
 * Horizontally-scrollable carousel of the latest PSS blog posts. Pulls live
 * from blog.pss.al so the homepage always reflects the marketing site. Hides
 * itself silently if the feed is empty or unreachable.
 */
export default function BlogCarousel() {
  const [posts, setPosts] = useState<ExternalPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${EXTERNAL_BLOG_BASE}/api/blog?page=1&limit=8`)
      .then(r => r.json())
      .then(d => { if (d?.success) setPosts(Array.isArray(d.data) ? d.data : []); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || posts.length === 0) return null;

  const scrollBy = (delta: number) => {
    if (trackRef.current) trackRef.current.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 pb-16">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Nga blog-u jone</h2>
          <p className="text-sm text-gray-500 mt-1">Lajme dhe keshilla nga Parid Smart Solution.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy(-360)}
            aria-label="Mbrapa"
            className="hidden sm:flex w-10 h-10 rounded-full bg-white shadow-sm hover:shadow text-gray-700 items-center justify-center"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scrollBy(360)}
            aria-label="Tjetri"
            className="hidden sm:flex w-10 h-10 rounded-full bg-white shadow-sm hover:shadow text-gray-700 items-center justify-center"
          >
            <ChevronRight size={18} />
          </button>
          <Link
            href="/blog"
            className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-[#1F3E76] hover:underline"
          >
            Te gjitha <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {posts.map((p) => {
          const imgUrl = p.featured_image ? `${EXTERNAL_BLOG_BASE}${p.featured_image}` : null;
          const publishedAt = p.published_at || p.PublishDate;
          return (
            <Link
              key={p.id}
              href={`/blog/${encodeURIComponent(p.category_slug || 'general')}/${encodeURIComponent(p.slug)}`}
              className="snap-start shrink-0 w-72 sm:w-80 bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden flex flex-col"
            >
              <div className="bg-gray-100 aspect-[16/9] overflow-hidden">
                {imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="p-4 flex flex-col flex-1">
                {p.category_name && (
                  <span
                    className="self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
                    style={{ backgroundColor: "#EEF2FF", color: "#1F3E76" }}
                  >
                    {p.category_name}
                  </span>
                )}
                <h3 className="font-extrabold text-gray-900 text-base leading-snug mb-1 line-clamp-2 min-h-[2.5rem]">
                  {p.title}
                </h3>
                {p.excerpt && (
                  <p className="text-xs text-gray-600 line-clamp-2 mb-3">{p.excerpt}</p>
                )}
                <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
                  <span>{publishedAt ? new Date(publishedAt).toLocaleDateString() : ""}</span>
                  <span className="font-semibold text-[#1F3E76]">Lexo →</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
