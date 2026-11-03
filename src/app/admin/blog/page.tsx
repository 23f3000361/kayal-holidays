import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { requireUser } from "@/server/auth";
import { adminListPosts } from "@/server/blog";
import { Badge, Card, EmptyState } from "@/components/ui";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { NewPostForm } from "./new-post-form";

export const metadata: Metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

const TONE = { Published: "ok", Draft: "neutral", Scheduled: "info", "Changes not published": "warn" } as const;

export default async function BlogAdmin() {
  await requireUser("blog.edit", "/admin/blog");
  const posts = await adminListPosts();
  return (
    <>
      <PageHeader title="Journal" subtitle="Stories that bring readers in from search and lead them to the right package." actions={<NewPostForm />} />
      <PageBody>
        <Card className="overflow-hidden">
          {posts.length === 0 ? (
            <EmptyState icon={<NotebookPen size={28} />} title="No posts yet" body="Write your first story with the box above." />
          ) : (
            <ul className="divide-y divide-line">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/blog/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper sm:px-5">
                    <div className="relative hidden h-14 w-20 shrink-0 overflow-hidden rounded-md bg-sand sm:block">{p.cover && <Image src={p.cover} alt="" fill sizes="80px" className="object-cover" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{p.title || "Untitled"}</p>
                      <p className="text-xs text-muted">{p.category} · {p.author ?? "Unknown"} · edited {p.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</p>
                    </div>
                    <Badge tone={TONE[p.status]}>{p.status}{p.status === "Scheduled" && p.publishAt ? ` · ${p.publishAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : ""}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
