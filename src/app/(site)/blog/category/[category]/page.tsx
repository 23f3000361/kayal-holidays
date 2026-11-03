import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLivePosts } from "@/server/blog";
import { categorySlug } from "@/lib/blog";
import { PostCard } from "@/components/site/post-card";

export const revalidate = 60;

export async function generateStaticParams() {
  return [...new Set((await getLivePosts()).map((p) => categorySlug(p.content.category)))].map((category) => ({ category }));
}

async function load(slug: string) {
  const posts = (await getLivePosts()).filter((p) => categorySlug(p.content.category) === slug);
  return { posts, name: posts[0]?.content.category ?? null };
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { name } = await load((await params).category);
  return name ? { title: `${name} · Journal`, alternates: { canonical: `/blog/category/${categorySlug(name)}` } } : { title: "Category not found" };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { posts, name } = await load((await params).category);
  if (!name) notFound();
  return (
    <div className="container-page pt-10 sm:pt-14">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Journal</Link>
      <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">{name}</h1>
      <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p, i) => <PostCard key={p.id} slug={p.slug} content={p.content} publishAt={p.publishAt} priority={i === 0} />)}
      </div>
    </div>
  );
}
