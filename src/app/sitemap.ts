import type { MetadataRoute } from "next";
import { getLivePackages } from "@/server/packages";
import { REGION_INFO } from "@/lib/regions";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const live = await getLivePackages();
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/packages`, changeFrequency: "weekly", priority: 0.9 },
    ...Object.values(REGION_INFO).map((r) => ({ url: `${site}/destinations/${r.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...live.map((p) => ({ url: `${site}/packages/${p.slug}`, lastModified: p.publishedAt, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${site}/enquire`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
