import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getPostForEditor } from "@/server/blog";
import { getLivePackages } from "@/server/packages";
import { PostView } from "@/components/site/post-view";

export const metadata: Metadata = { title: "Preview post", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PostPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("blog.edit", `/admin/blog/${id}/preview`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ed = await getPostForEditor(id);
  if (!ed) notFound();
  const live = (await getLivePackages()).map((p) => ({ slug: p.slug, content: p.content }));
  const related = ed.post.draft.relatedPackages.map((s) => live.find((p) => p.slug === s)).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper">
      <div className="sticky top-0 z-50 bg-ink text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <p className="flex items-center gap-2"><Eye size={15} /> Preview of the draft. Status: {ed.status}</p>
          <Link href={`/admin/blog/${id}`} className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20">Back to editor</Link>
        </div>
      </div>
      <PostView content={ed.post.draft} publishAt={ed.post.publishAt} author={user.name} packages={live} related={related} />
    </div>
  );
}
