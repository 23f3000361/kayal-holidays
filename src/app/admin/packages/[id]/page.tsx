import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/server/auth";
import { getPackageForEditor } from "@/server/packages";
import { can } from "@/lib/permissions";
import credits from "@/data/photo-credits.json";
import { Alert } from "@/components/ui";
import { PageHeader } from "@/components/admin/bits";
import { PackageEditor } from "./editor";

export const metadata: Metadata = { title: "Edit package" };
export const dynamic = "force-dynamic";

export default async function EditPackagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicated?: string }> }) {
  const { id } = await params;
  const user = await requireUser("packages.view", `/admin/packages/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ed = await getPackageForEditor(id);
  if (!ed) notFound();
  const { duplicated } = await searchParams;

  const uploads = await db.select({ id: s.media.id, alt: s.media.alt }).from(s.media).orderBy(desc(s.media.createdAt)).limit(60);
  const library = [
    ...uploads.map((m) => ({ src: `/media/${m.id}`, alt: m.alt })),
    ...Object.entries(credits as Record<string, { title: string }>).map(([key, c]) => ({ src: `/photos/${key}.jpg`, alt: c.title.replace(/^File:|\.\w+$/g, "") })),
  ];

  return (
    <>
      <PageHeader
        back={<Link href="/admin/packages" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Packages</Link>}
        title={ed.draft.title || "Untitled package"}
        subtitle={<span className="tabular">{ed.pkg.code} · /packages/{ed.pkg.slug}</span>}
      />
      {duplicated && <div className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-8"><Alert tone="ok">Copy created as a draft. Give it its own title and code before publishing.</Alert></div>}
      <PackageEditor
        id={ed.pkg.id}
        code={ed.pkg.code}
        slug={ed.pkg.slug}
        draft={ed.draft}
        live={ed.live?.content ?? null}
        liveVersion={ed.live?.versionNo ?? null}
        statusLabel={ed.status.label}
        scheduledAt={ed.status.scheduledAt?.toISOString() ?? null}
        hasReleases={ed.releases.length > 0}
        library={library}
        canEdit={can(user.role, "packages.edit")}
        canPublish={can(user.role, "packages.publish")}
        canUpload={can(user.role, "media.upload")}
        savedAt={ed.draftSavedAt.toISOString()}
      />
    </>
  );
}
