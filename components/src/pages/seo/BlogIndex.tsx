import { Link } from "react-router-dom";
import { useSeo } from "@/hooks/use-seo";
import { blogPosts } from "@/data/blogPosts";
import { Breadcrumbs, SeoPageShell } from "./shared";
import { SITE_NAME, breadcrumbJsonLd } from "@/lib/seo";

/** /blog/ — playing guides. Only real, useful editorial content is listed. */
export function BlogIndex() {
  useSeo({
    title: `Playing Guides — Turf Booking Tips | ${SITE_NAME}`,
    description: `Practical guides for booking and playing on sports turfs: how to book, what to bring, and when slots are cheapest. Written for players, based on how ${SITE_NAME} actually works.`,
    path: "/blog",
    jsonLd: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Guides", path: "/blog" },
      ]),
    ],
  });

  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <SeoPageShell>
      <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Guides", path: "/blog" }]} />
      <h1 className="px-4 mt-3 font-display font-extrabold text-2xl text-foreground">Playing Guides</h1>
      <p className="px-4 mt-2 text-sm text-soft max-w-xl">
        Short, practical answers to the questions players actually ask before booking a turf.
      </p>

      <div className="px-4 mt-5 space-y-3">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="pressable block rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel p-4"
          >
            <h2 className="font-bold text-sm text-foreground">{post.title}</h2>
            <p className="text-xs text-soft mt-1.5 line-clamp-2">{post.description}</p>
            <p className="text-[11px] text-muted2 mt-2">
              {fmt(post.datePublished)} · {post.readMinutes} min read
            </p>
          </Link>
        ))}
      </div>
    </SeoPageShell>
  );
}
