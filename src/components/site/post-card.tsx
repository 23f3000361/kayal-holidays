import Image from "next/image";
import Link from "next/link";
import type { PostContent } from "@/lib/blog";
import { readingMinutes } from "@/lib/markdown";

export const postDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export function PostCard({ slug, content, publishAt, priority }: { slug: string; content: PostContent; publishAt: Date; priority?: boolean }) {
  return (
    <Link href={`/blog/${slug}`} className="group block">
      <div className="relative aspect-[3/2] overflow-hidden rounded-[var(--radius-card)] bg-sand">
        {content.cover && <Image src={content.cover.src} alt={content.cover.alt} fill priority={priority} quality={60} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-muted">{content.category} · {readingMinutes(content.body)} min read</p>
      <h3 className="mt-1 font-display text-xl leading-snug text-ink group-hover:text-accent">{content.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{content.excerpt}</p>
      <p className="mt-2 text-xs text-faint">{postDate(publishAt)}</p>
    </Link>
  );
}
