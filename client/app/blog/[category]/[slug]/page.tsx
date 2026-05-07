"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Navbar from "../../../components/Navbar";
import LinkSheet from "../../../components/LinkSheet";

const EXTERNAL_BLOG_BASE = "https://blog.pss.al:8001";

type ExternalBlock = {
  BlockId: number;
  SortOrder: number;
  BlockType: string;
  Title?: string | null;
  Body?: string | null;
};

type ExternalPost = {
  PostId: number;
  Title: string;
  Slug: string;
  Subtitle?: string | null;
  Excerpt?: string | null;
  PublishedAtUtc?: string | null;
  PublishDate?: string | null;
  featured_image?: string | null;
  blocks?: ExternalBlock[];
};

export default function BlogPostPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [post, setPost] = useState<ExternalPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  // Bottom-sheet for external links inside the article body
  const [sheet, setSheet] = useState<{ url: string; title?: string } | null>(null);
  const articleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json()).then(d => { if (d?.success) setConfig(d.config); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${EXTERNAL_BLOG_BASE}/api/blog/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(d => { if (d?.success && d?.data?.post) setPost(d.data.post as ExternalPost); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Concatenate the post's blocks in SortOrder. The external API returns
  // each section as its own row of HTML; rendering them as one stream keeps
  // the prose-blog styles uniform.
  const bodyHtml = useMemo(() => {
    if (!post?.blocks || !Array.isArray(post.blocks)) return "";
    return [...post.blocks]
      .sort((a, b) => (a.SortOrder ?? 0) - (b.SortOrder ?? 0))
      .map((b) => b.Body || "")
      .join("\n");
  }, [post]);

  /**
   * Click delegation for the dangerouslySetInnerHTML article body. Any <a>
   * the admin author inserted via the editor is intercepted here:
   *   - In-app links (relative or same-host) navigate normally so Next can
   *     do client-side routing.
   *   - External links open the bottom-sheet preview instead of leaving
   *     the shop. Modifier-clicks (cmd/ctrl/middle) are honored as new tab.
   */
  useEffect(() => {
    const root = articleRef.current;
    if (!root || !post) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      let a: HTMLAnchorElement | null = null;
      let n: HTMLElement | null = target;
      while (n && n !== root) {
        if (n.tagName === "A") { a = n as HTMLAnchorElement; break; }
        n = n.parentElement;
      }
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;
      // Honour modifier clicks → let the browser open a new tab as usual
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      let url: URL;
      try { url = new URL(href, window.location.origin); } catch { return; }
      const isInApp = url.origin === window.location.origin;
      if (isInApp) return; // let Next.js handle in-app routes natively
      e.preventDefault();
      setSheet({ url: url.toString(), title: a.textContent?.trim() || undefined });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [post]);

  const coverImageUrl = post?.featured_image ? `${EXTERNAL_BLOG_BASE}${post.featured_image}` : null;
  const publishedAt = post?.PublishedAtUtc || post?.PublishDate;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar config={config} cartCount={0} onCartOpen={() => {}} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Kthehu te blog
        </Link>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Duke ngarkuar...</div>
        ) : !post ? (
          <div className="text-center py-20 text-gray-500">Postimi nuk u gjet.</div>
        ) : (
          <article className="bg-white rounded-3xl shadow-sm overflow-hidden">
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImageUrl}
                alt=""
                className="w-full h-auto max-h-[520px] object-contain bg-gray-50"
              />
            )}
            <div className="p-6 sm:p-10">
              <h1 className="font-extrabold text-gray-900 leading-tight mb-4 text-4xl sm:text-5xl">
                {post.Title}
              </h1>
              {post.Subtitle && (
                <p className="text-xl text-gray-700 mb-4">{post.Subtitle}</p>
              )}
              {publishedAt && (
                <p className="text-sm text-gray-500 mb-6">
                  Publikuar me {new Date(publishedAt).toLocaleDateString('sq-AL', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
              {post.Excerpt && (
                <p className="text-lg text-gray-700 mb-6 leading-relaxed">{post.Excerpt}</p>
              )}

              {/* Body — rendered from the concatenated blocks of the external
                  PSS blog API. External link clicks are intercepted (see
                  useEffect above) and previewed inside LinkSheet instead of
                  navigating away from the shop. */}
              <div
                ref={articleRef}
                className="prose-blog text-gray-800 leading-7"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </div>
          </article>
        )}
      </div>

      {/* Bottom-sheet preview for external links inside the article body */}
      <LinkSheet
        url={sheet?.url || null}
        title={sheet?.title}
        open={!!sheet}
        onClose={() => setSheet(null)}
      />

      <style jsx global>{`
        .prose-blog h2 { font-size: 1.6rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; color: #111827; }
        .prose-blog h3 { font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #111827; }
        .prose-blog p { margin: 0.85rem 0; }
        .prose-blog ul, .prose-blog ol { padding-left: 1.5rem; margin: 0.85rem 0; }
        .prose-blog ul { list-style: disc; }
        .prose-blog ol { list-style: decimal; }
        .prose-blog blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #4b5563; margin: 1.25rem 0; }
        .prose-blog a { color: #2563eb; text-decoration: underline; }
        .prose-blog a:hover { color: #1d4ed8; }
        .prose-blog img { max-width: 100%; border-radius: 0.5rem; margin: 1.25rem 0; }
        .prose-blog hr { margin: 1.75rem 0; border: none; border-top: 1px solid #e5e7eb; }
      `}</style>
    </div>
  );
}
