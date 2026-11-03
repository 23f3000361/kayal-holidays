import Image from "next/image";
import Link from "next/link";
import type { PostContent } from "@/lib/blog";
import { categorySlug } from "@/lib/blog";
import { readingMinutes } from "@/lib/markdown";
import { buttonClass } from "@/components/ui";
import { Markdown, PackageInlineCard, type EmbedPackage } from "./markdown";
import { postDate } from "./post-card";

/** One component for the live post and the editor's preview, so a preview is exactly what goes live. */
export function PostView({ content: c, publishAt, author, packages, related }: { content: PostContent; publishAt: Date | null; author: string | null; packages: EmbedPackage[]; related: EmbedPackage[] }) {
  return (
    <article className="pb-16">
      <header className="container-page max-w-3xl pt-10 sm:pt-14">
        <Link href={`/blog/category/${categorySlug(c.category)}`} className="text-xs uppercase tracking-[0.16em] text-accent hover:underline">{c.category}</Link>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink sm:text-5xl">{c.title}</h1>
        {c.excerpt && <p className="mt-4 text-xl leading-relaxed text-muted">{c.excerpt}</p>}
        <p className="mt-5 text-sm text-faint">{[author, publishAt ? postDate(publishAt) : "Not published", `${readingMinutes(c.body)} min read`].filter(Boolean).join(" · ")}</p>
      </header>
      {c.cover && (
        <div className="container-page mt-8 max-w-5xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-card)] bg-sand">
            <Image src={c.cover.src} alt={c.cover.alt} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
          </div>
        </div>
      )}
      <div className="container-page mt-10 max-w-[680px]">
        <Markdown source={c.body} packages={packages} />
      </div>
      {related.length > 0 && (
        <section className="container-page mt-16 max-w-3xl border-t border-line pt-10" aria-labelledby="related">
          <h2 id="related" className="font-display text-2xl text-ink">Trips for this story</h2>
          <p className="mt-1 text-sm text-muted">Private, adjustable, and priced per person on twin sharing.</p>
          <div className="mt-2">{related.map((p) => <PackageInlineCard key={p.slug} pkg={p} />)}</div>
          <div className="mt-2 rounded-[var(--radius-card)] bg-sand/70 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <p className="text-ink-2">Not quite right? Tell us what you have in mind and a consultant replies within one working hour.</p>
            <Link href="/enquire" className={buttonClass("primary", "md", "mt-4 shrink-0 sm:mt-0")}>Plan a trip</Link>
          </div>
        </section>
      )}
    </article>
  );
}
