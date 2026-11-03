import Image from "next/image";
import Link from "next/link";
import type { PackageContent } from "@/lib/package-content";
import { formatINR, lowestPrice } from "@/lib/pricing";

export function PackageCard({ slug, content, priority }: { slug: string; content: PackageContent; priority?: boolean }) {
  const from = lowestPrice(content);
  const cover = content.photos[0];
  return (
    <Link href={`/packages/${slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] bg-sand">
        {cover && (
          <Image src={cover.src} alt={cover.alt} fill priority={priority} quality={60} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink backdrop-blur">
          {content.durationDays} days · {content.durationDays - 1} nights
        </span>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-xs uppercase tracking-[0.12em] text-muted">{content.destinations.join(" · ")}</p>
        <h3 className="font-display text-lg leading-snug text-ink group-hover:text-accent">{content.title}</h3>
        {from && (
          <p className="text-sm text-muted">
            From <span className="tabular font-medium text-ink">{formatINR(from)}</span> per person
          </p>
        )}
      </div>
    </Link>
  );
}
