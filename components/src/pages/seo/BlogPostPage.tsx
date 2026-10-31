import { Link, useParams } from "react-router-dom";
import { useSeo } from "@/hooks/use-seo";
import { blogPosts, getBlogPost, type BlogSection } from "@/data/blogPosts";
import { Breadcrumbs, SeoPageShell } from "./shared";
import { articleJsonLd, breadcrumbJsonLd, SITE_NAME } from "@/lib/seo";

/** /blog/:slug/ — a single guide. Answers the title question in the first block. */
export function BlogPostPage() {
  const { slug = "" } = useParams();
  const post = getBlogPost(slug);

  useSeo(
    post
      ? {
          title: `${post.title} | ${SITE_NAME}`,
          description: post.description,
          path: `/blog/${post.slug}`,
          ogType: "article",
          jsonLd: [
            articleJsonLd({
              slug: post.slug,
              title: post.title,
              description: post.description,
              datePublished: post.datePublished,
              dateModified: post.dateModified,
            }),
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Guides", path: "/blog" },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
          ],
        }
      : {
          title: `Guide not found | ${SITE_NAME}`,
          description: "This guide does not exist.",
          path: `/blog/${slug}`,
          noindex: true,
        }
  );

  if (!post) {
    return (
      <SeoPageShell>
        <Breadcrumbs crumbs={[{ name: "Home", path: "/" }, { name: "Guides", path: "/blog" }]} />
        <div className="px-6 py-16 text-center">
          <h1 className="font-display font-extrabold text-xl text-foreground">Guide not found</h1>
          <p className="mt-2 text-sm text-soft">Browse our playing guides instead.</p>
          <Link
            to="/blog"
            className="mt-6 inline-block rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-5 py-2.5"
          >
            All guides
          </Link>
        </div>
      </SeoPageShell>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const renderSection = (s: BlogSection, i: number) => (
    <section key={i} className="mt-6">
      <h2 className="font-display font-bold text-base text-foreground">{s.heading}</h2>
      {Array.isArray(s.body) ? (
        <ul className="mt-2.5 space-y-2">
          {s.body.map((item, j) => (
            <li key={j} className="text-sm text-soft leading-relaxed flex gap-2">
              <span aria-hidden className="text-primary mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-sm text-soft leading-relaxed">{s.body}</p>
      )}
    </section>
  );

  return (
    <SeoPageShell>
      <Breadcrumbs
        crumbs={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />
      <article className="px-4 pb-16">
        <h1 className="mt-3 font-display font-extrabold text-2xl text-foreground leading-snug">
          {post.title}
        </h1>
        <p className="text-[11px] text-muted2 mt-2">
          {fmt(post.datePublished)}
          {post.dateModified ? ` · updated ${fmt(post.dateModified)}` : ""} · {post.readMinutes} min read
        </p>

        {/* Direct answer block — the exact question the title asks (AEO) */}
        <div className="mt-4 rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel-2 p-4">
          <p className="text-sm text-foreground leading-relaxed font-medium">{post.answer}</p>
        </div>

        {post.sections.map(renderSection)}

        <div className="mt-9 rounded-2xl bg-panel border border-[hsl(var(--color-border-default))] p-4">
          <p className="text-sm font-bold text-foreground">Ready to play?</p>
          <p className="text-xs text-soft mt-1.5">
            Browse venues with live slot availability, or join an open game and split the court cost.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/turfs"
              className="pressable rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-4 py-2"
            >
              Browse turfs
            </Link>
            <Link
              to="/open-games"
              className="pressable rounded-full border border-[hsl(var(--color-border-default))] bg-panel-2 text-xs font-bold uppercase tracking-wider px-4 py-2 text-foreground"
            >
              Open games
            </Link>
          </div>
        </div>

        {blogPosts.length > 1 && (
          <nav aria-label="More guides" className="mt-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted2 mb-2.5">
              More guides
            </h2>
            <ul className="space-y-2">
              {blogPosts
                .filter((p) => p.slug !== post.slug)
                .map((p) => (
                  <li key={p.slug}>
                    <Link to={`/blog/${p.slug}`} className="text-sm text-primary underline underline-offset-2">
                      {p.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        )}
      </article>
    </SeoPageShell>
  );
}
