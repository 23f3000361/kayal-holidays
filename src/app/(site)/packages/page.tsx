import type { Metadata } from "next";
import { Suspense } from "react";
import { getLivePackages } from "@/server/packages";
import { PackageBrowser, PackageResults } from "./browser";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "All packages",
  description: "Private Kerala and South India holiday packages: houseboats, hill stations, beaches, wildlife and temple towns. Prices per person, twin sharing.",
  alternates: { canonical: "/packages" },
};

export default async function PackagesPage() {
  const live = await getLivePackages();
  // Only what cards and search need, to keep the page payload small.
  const items = live.map((p) => ({
    id: p.id,
    slug: p.slug,
    content: { ...p.content, itinerary: [], inclusions: [], exclusions: [], hotels: [], mapStops: [], photos: p.content.photos.slice(0, 1) },
  }));

  return (
    <div className="container-page pt-10 sm:pt-14">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Holidays in South India</h1>
      <p className="mt-3 max-w-xl text-muted">Every package is private and can be adjusted. Prices are per person on twin sharing, plus 5% GST.</p>
      {/* The static HTML lists every package (good for search engines); filters apply in the browser. */}
      <Suspense fallback={<PackageResults items={items} params={{}} />}>
        <PackageBrowser items={items} />
      </Suspense>
    </div>
  );
}
