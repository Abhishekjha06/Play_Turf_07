/**
 * Shared renderer for the trust anchor pages (/about, /contact, /privacy).
 * Copy comes from trust-content.json — the same source the build-time agent
 * content generator uses, so crawlers without JS see identical wording.
 */
import { Link } from "react-router-dom";
import { useSeo } from "@/hooks/use-seo";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import trustContent from "@/data/trust-content.json";
import { SITE_ORIGIN, SITE_NAME, breadcrumbJsonLd, type Crumb } from "@/lib/seo";

type Section = { h2: string; body: string };
type PageKey = "about" | "contact" | "privacy";

const PAGE_PATH: Record<PageKey, string> = {
  about: "/about",
  contact: "/contact",
  privacy: "/privacy",
};

export function TrustPage({ page }: { page: PageKey }) {
  const data = trustContent[page];
  useSeo({
    title: `${data.title} | ${SITE_NAME}`,
    description: data.description,
    path: PAGE_PATH[page],
    jsonLd: [
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: data.title, path: PAGE_PATH[page] },
      ] as Crumb[]),
    ],
  });

  return (
    <MobileShell>
      <div className="px-5 pt-6">
        <BackButton />
      </div>
      <article className="px-5 pt-4 pb-24 max-w-2xl mx-auto">
        <h1 className="font-display font-extrabold text-2xl text-foreground">{data.title}</h1>
        <p className="mt-2 text-sm text-soft leading-relaxed">{data.description}</p>
        {data.sections.map((s: Section) => (
          <section key={s.h2} className="mt-7">
            <h2 className="font-display font-bold text-base text-foreground">{s.h2}</h2>
            <p className="mt-2 text-sm text-soft leading-relaxed">{s.body}</p>
          </section>
        ))}
        <div className="mt-10 rounded-2xl border border-[hsl(var(--color-border-default))] bg-panel p-4">
          <p className="text-xs text-soft">
            Explore PlayTurf:{" "}
            <Link to="/turfs" className="text-primary underline underline-offset-2">browse turfs</Link>
            {" · "}
            <Link to="/open-games" className="text-primary underline underline-offset-2">open games</Link>
            {" · "}
            <Link to="/blog" className="text-primary underline underline-offset-2">playing guides</Link>
          </p>
          <p className="mt-2 text-[10px] text-muted2">Official site: {SITE_ORIGIN}</p>
        </div>
      </article>
    </MobileShell>
  );
}

export default function AboutPage() {
  return <TrustPage page="about" />;
}
