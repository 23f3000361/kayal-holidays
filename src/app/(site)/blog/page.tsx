import type { Metadata } from "next";
import Link from "next/link";
import { getLivePosts } from "@/server/blog";
import { categorySlug } from "@/lib/blog";
import { PostCard } from "@/components/site/post-card";
import { EmptyState, ButtonLink } from "@/components/ui";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Journal",
  description: "Travel notes from Kerala and South India: when to go, where to stay and how to plan, from consultants who live here.",
  alternates: { canonical: "/blog" },
};

export default async function BlogPage() {
  const posts = await getLivePosts();
  const cats = [...new Set(posts.map((p) => p.content.category))];
  return (
    <div className="container-page pt-10 sm:pt-14">
      <h1 className="font-display text-4xl text-ink sm:text-5xl">Journal</h1>
      <p className="mt-3 max-w-xl text-muted">Notes on when to go, where to stay and what is worth your time, from the team in Kochi.</p>
      {cats.length > 1 && (
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Categories">
          {cats.map((c) => (
            <Link key={c} href={`/blog/category/${categorySlug(c)}`} className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">{c}</Link>
          ))}
        </nav>
      )}
      {posts.length === 0 ? (
        <EmptyState title="No posts yet" body="Our first stories are on their way." action={<ButtonLink href="/packages">Browse packages</ButtonLink>} />
      ) : (
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p, i) => <PostCard key={p.id} slug={p.slug} content={p.content} publishAt={p.publishAt} priority={i === 0} />)}
        </div>
      )}
    </div>
  );
}
