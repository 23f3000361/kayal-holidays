import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { parseMarkdown, type Inline } from "@/lib/markdown";
import { formatINR, lowestPrice } from "@/lib/pricing";
import type { PackageContent } from "@/lib/package-content";

export type EmbedPackage = { slug: string; content: PackageContent };

function Inl({ c }: { c: Inline[] }) {
  return (
    <>
      {c.map((x, i) =>
        x.t === "text" ? (
          <span key={i}>{x.v}</span>
        ) : x.t === "b" ? (
          <strong key={i} className="font-semibold text-ink"><Inl c={x.c} /></strong>
        ) : x.t === "i" ? (
          <em key={i}><Inl c={x.c} /></em>
        ) : x.href.startsWith("/") ? (
          <Link key={i} href={x.href} className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"><Inl c={x.c} /></Link>
        ) : (
          <a key={i} href={x.href} rel="noopener noreferrer nofollow" target="_blank" className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"><Inl c={x.c} /></a>
        ),
      )}
    </>
  );
}

/** Compact card used inside posts and under them. */
export function PackageInlineCard({ pkg }: { pkg: EmbedPackage }) {
  const from = lowestPrice(pkg.content);
  const cover = pkg.content.photos[0];
  return (
    <Link href={`/packages/${pkg.slug}`} className="group my-8 flex items-stretch overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-soft)] not-prose">
      <div className="relative w-28 shrink-0 bg-sand sm:w-44">{cover && <Image src={cover.src} alt="" fill sizes="176px" quality={60} className="object-cover" />}</div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4">
        <p className="text-xs uppercase tracking-[0.12em] text-muted">{pkg.content.durationDays} days · {pkg.content.region}</p>
        <p className="font-display text-lg leading-snug text-ink group-hover:text-accent">{pkg.content.title}</p>
        <p className="flex items-center gap-1 text-sm text-muted">{from ? <>From <span className="tabular font-medium text-ink">{formatINR(from)}</span> per person</> : "Price on request"}<ArrowRight size={14} className="ml-auto text-accent transition-transform group-hover:translate-x-0.5" /></p>
      </div>
    </Link>
  );
}

/** Renders post Markdown. Unknown package references render nothing rather than a broken card. */
export function Markdown({ source, packages }: { source: string; packages: EmbedPackage[] }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="space-y-5 text-[17px] leading-[1.75] text-ink-2">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2": return <h2 key={i} className="pt-4 font-display text-2xl leading-snug text-ink"><Inl c={b.c} /></h2>;
          case "h3": return <h3 key={i} className="pt-2 text-lg font-semibold text-ink"><Inl c={b.c} /></h3>;
          case "p": return <p key={i}><Inl c={b.c} /></p>;
          case "quote": return <blockquote key={i} className="border-l-2 border-gold py-1 pl-5 font-display text-xl italic leading-relaxed text-ink"><Inl c={b.c} /></blockquote>;
          case "ul": return <ul key={i} className="list-disc space-y-1.5 pl-6 marker:text-gold">{b.items.map((it, j) => <li key={j}><Inl c={it} /></li>)}</ul>;
          case "ol": return <ol key={i} className="list-decimal space-y-1.5 pl-6 marker:text-muted">{b.items.map((it, j) => <li key={j}><Inl c={it} /></li>)}</ol>;
          case "hr": return <hr key={i} className="my-8 border-line" />;
          case "img": return <figure key={i} className="relative my-8 aspect-[3/2] overflow-hidden rounded-[var(--radius-card)] bg-sand"><Image src={b.src} alt={b.alt} fill sizes="(min-width: 768px) 720px, 100vw" className="object-cover" /></figure>;
          case "package": {
            const pkg = packages.find((p) => p.slug === b.slug);
            return pkg ? <PackageInlineCard key={i} pkg={pkg} /> : null;
          }
        }
      })}
    </div>
  );
}
