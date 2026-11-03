import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLivePackages } from "@/server/packages";
import { REGION_INFO, regionFromSlug } from "@/lib/regions";
import { PackageCard } from "@/components/site/package-card";
import { EmptyState, ButtonLink } from "@/components/ui";

export const revalidate = 60;

export function generateStaticParams() {
  return Object.values(REGION_INFO).map((r) => ({ region: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
  const region = regionFromSlug((await params).region);
  if (!region) return { title: "Destination not found" };
  return { title: `${region} holiday packages`, description: `${REGION_INFO[region].blurb} Private ${region} tours with prices per person.`, alternates: { canonical: `/destinations/${REGION_INFO[region].slug}` } };
}

export default async function DestinationPage({ params }: { params: Promise<{ region: string }> }) {
  const region = regionFromSlug((await params).region);
  if (!region) notFound();
  const info = REGION_INFO[region];
  const items = (await getLivePackages()).filter((p) => p.content.region === region);

  return (
    <>
      <section className="relative flex h-[46vh] min-h-[300px] items-end bg-ink">
        <Image src={info.photo} alt={region} fill priority sizes="100vw" className="object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="container-page relative pb-10">
          <h1 className="font-display text-5xl text-white sm:text-6xl">{region}</h1>
          <p className="mt-3 max-w-xl text-lg text-white/85">{info.blurb}</p>
        </div>
      </section>
      <section className="container-page pt-14">
        {items.length === 0 ? (
          <EmptyState title={`No ${region} packages online right now`} body="We still plan trips here. Tell us what you'd like." action={<ButtonLink href="/enquire">Plan a custom trip</ButtonLink>} />
        ) : (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => <PackageCard key={p.id} slug={p.slug} content={p.content} priority={i < 3} />)}
          </div>
        )}
      </section>
    </>
  );
}
