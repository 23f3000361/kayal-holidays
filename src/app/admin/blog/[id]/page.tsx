import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/server/auth";
import { categories, getPostForEditor } from "@/server/blog";
import { getLivePackages } from "@/server/packages";
import credits from "@/data/photo-credits.json";
import { PageHeader } from "@/components/admin/bits";
import { PostEditor } from "./post-editor";

export const metadata: Metadata = { title: "Edit post" };
export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser("blog.edit", `/admin/blog/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ed = await getPostForEditor(id);
  if (!ed) notFound();
  const [cats, live, uploads] = await Promise.all([
    categories(),
    getLivePackages(),
    db.select({ id: s.media.id, alt: s.media.alt }).from(s.media).orderBy(desc(s.media.createdAt)).limit(60),
  ]);
  const library = [
    ...uploads.map((m) => ({ src: `/media/${m.id}`, alt: m.alt })),
    ...Object.entries(credits as Record<string, { title: string }>).map(([key, c]) => ({ src: `/photos/${key}.jpg`, alt: c.title.replace(/^File:|\.\w+$/g, "") })),
  ];
  return (
    <>
      <PageHeader
        back={<Link href="/admin/blog" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Journal</Link>}
        title={ed.post.draft.title || "Untitled post"}
        subtitle={ed.live ? <Link href={`/blog/${ed.post.slug}`} target="_blank" className="inline-flex items-center gap-1 hover:text-ink">/blog/{ed.post.slug} <ExternalLink size={12} /></Link> : `/blog/${ed.post.slug}`}
      />
      <PostEditor
        id={ed.post.id}
        slug={ed.post.slug}
        draft={ed.post.draft}
        status={ed.status}
        live={ed.live}
        publishAt={ed.post.publishAt?.toISOString() ?? null}
        categories={cats}
        packages={live.map((p) => ({ slug: p.slug, code: p.code, content: p.content }))}
        library={library}
      />
    </>
  );
}
