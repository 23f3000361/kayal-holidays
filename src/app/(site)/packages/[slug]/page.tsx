import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getLiveBySlug, getLivePackages } from "@/server/packages";
import { PackageView } from "@/components/site/package-view";
import { lowestPrice } from "@/lib/pricing";
import { regionSlug } from "@/lib/regions";

// Server-rendered and cached; publishing revalidates the page at once, and the 60 s
// window lets scheduled releases go live without anyone pressing a button.
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getLivePackages()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getLiveBySlug((await params).slug);
  if (!p) return { title: "Package not found" };
  const c = p.content;
  return {
    title: c.seoTitle || c.title,
    description: c.seoDescription || c.summary,
    alternates: { canonical: `/packages/${p.slug}` },
    openGraph: { title: c.seoTitle || c.title, description: c.seoDescription || c.summary, images: c.photos[0] ? [{ url: c.photos[0].src, alt: c.photos[0].alt }] : [] },
  };
}

export default async function PackagePage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getLiveBySlug((await params).slug);
  if (!p) notFound();
  const c = p.content;
  const from = lowestPrice(c);
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: c.title,
    description: c.summary,
    touristType: c.themes,
    itinerary: { "@type": "ItemList", itemListElement: c.itinerary.map((d) => ({ "@type": "ListItem", position: d.day, name: d.title, description: d.description })) },
    ...(from ? { offers: { "@type": "Offer", price: from, priceCurrency: "INR", description: "Per person, twin sharing, excluding GST", url: `${site}/packages/${p.slug}` } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="container-page py-3 text-xs text-muted">
        <Link href="/packages" className="hover:text-ink">Packages</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/destinations/${regionSlug(c.region)}`} className="hover:text-ink">{c.region}</Link> <span aria-hidden>/</span> <span className="text-ink-2">{c.title}</span>
      </nav>
      <PackageView content={c} packageId={p.id} code={p.code} />
    </>
  );
}
