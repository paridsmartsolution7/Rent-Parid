"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";

const EXTERNAL_BLOG_BASE = "https://blog.pss.al:8001";

type ExternalPost = {
  id: number;
  slug: string;
  title: string;
  excerpt?: string | null;
  featured_image?: string | null;
  PublishDate?: string | null;
  published_at?: string | null;
  ViewCount?: string | number | null;
  views?: string | number | null;
  category_name?: string | null;
  category_slug?: string | null;
};

function buildImageUrl(featuredImage?: string | null): string | null {
  if (!featuredImage) return null;
  return `${EXTERNAL_BLOG_BASE}${featuredImage}`;
}

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BlogPageInner />
    </Suspense>
  );
}

function BlogPageInner() {
  const [posts, setPosts] = useState<ExternalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json()).then(d => { if (d?.success) setConfig(d.config); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    // External feed from blog.pss.al — pulls the live PSS blog so the
    // ecommerce site stays in sync with whatever marketing publishes there.
    fetch(`${EXTERNAL_BLOG_BASE}/api/blog?page=1&limit=24`)
      .then(r => r.json())
      .then(d => { if (d?.success) setPosts(Array.isArray(d.data) ? d.data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={0} onCartOpen={() => {}} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">Blog</h1>
        <p className="text-gray-600 mb-6">Lajme, keshilla dhe artikuj nga Parid Smart Solution.</p>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Duke ngarkuar...</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">Nuk ka postime per momentin.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => {
              const imgUrl = buildImageUrl(p.featured_image);
              const publishedAt = p.published_at || p.PublishDate;
              return (
                <Link
                  key={p.id}
                  href={`/blog/${encodeURIComponent(p.category_slug || "general")}/${encodeURIComponent(p.slug)}`}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden flex flex-col"
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
                  <div className="p-5 flex flex-col flex-1">
                    {p.category_name && (
                      <span
                        className="self-start text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3"
                        style={{ backgroundColor: "#EEF2FF", color: "#1F3E76" }}
                      >
                        {p.category_name}
                      </span>
                    )}
                    <h2 className="font-extrabold text-gray-900 leading-tight mb-2 text-2xl sm:text-3xl">
                      {p.title}
                    </h2>
                    {p.excerpt && (
                      <p className="text-sm text-gray-600 line-clamp-3 mb-3">{p.excerpt}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
                      <span>{publishedAt ? new Date(publishedAt).toLocaleDateString() : ""}</span>
                      <span className="font-semibold text-[#1F3E76]">Lexo me shume →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
