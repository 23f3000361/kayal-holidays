import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLivePost, getLivePosts } from "@/server/blog";
import { getLivePackages } from "@/server/packages";
import { packageSlugsIn } from "@/lib/markdown";
import { PostView } from "@/components/site/post-view";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getLivePosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getLivePost((await params).slug);
  if (!p) return { title: "Post not found" };
  const c = p.content;
  return {
    title: c.seoTitle || c.title,
    description: c.seoDescription || c.excerpt,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: c.seoTitle || c.title, description: c.seoDescription || c.excerpt, publishedTime: p.publishAt.toISOString(), images: c.cover ? [{ url: c.cover.src, alt: c.cover.alt }] : [] },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getLivePost((await params).slug);
  if (!p) notFound();
  const live = await getLivePackages();
  const wanted = new Set([...p.content.relatedPackages, ...packageSlugsIn(p.content.body)]);
  const packages = live.filter((x) => wanted.has(x.slug)).map((x) => ({ slug: x.slug, content: x.content }));
  const related = p.content.relatedPackages.map((s) => packages.find((x) => x.slug === s)).filter((x): x is NonNullable<typeof x> => !!x);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.content.title,
    description: p.content.excerpt,
    datePublished: p.publishAt.toISOString(),
    author: { "@type": "Organization", name: "Kayal Holidays" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PostView content={p.content} publishAt={p.publishAt} author={p.author} packages={packages} related={related} />
    </>
  );
}
