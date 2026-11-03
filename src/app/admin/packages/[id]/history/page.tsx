import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getPackageForEditor } from "@/server/packages";
import { diffContent } from "@/lib/versions";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState } from "@/components/ui";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { VersionActions } from "./version-actions";

export const metadata: Metadata = { title: "Version history" };
export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("packages.view", `/admin/packages/${id}/history`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ed = await getPackageForEditor(id);
  if (!ed) notFound();
  const ordered = [...ed.releases].sort((a, b) => a.versionNo - b.versionNo);

  return (
    <>
      <PageHeader
        back={<Link href={`/admin/packages/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Back to editor</Link>}
        title="Version history"
        subtitle={`${ed.pkg.code} · every published or scheduled version is kept and can be copied back into the draft.`}
      />
      <PageBody className="max-w-4xl">
        {ordered.length === 0 ? (
          <Card><EmptyState title="Never published" body="This package exists only as a draft. Publish it to start its history." /></Card>
        ) : (
          <ol className="space-y-4">
            {[...ordered].reverse().map((r) => {
              const prev = ordered.filter((x) => x.versionNo < r.versionNo).at(-1);
              const changes = diffContent(prev?.content ?? null, r.content);
              return (
                <li key={r.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          Version {r.versionNo}
                          {r.isLive && <Badge tone="ok">Live now</Badge>}
                          {r.isScheduled && <Badge tone="info">Scheduled</Badge>}
                          {r.visibility === "hidden" && <Badge tone="neutral">Unpublished</Badge>}
                        </p>
                        <p className="mt-0.5 text-sm text-muted">{r.isScheduled ? "Goes live" : "Went live"} {fmt(r.publishAt!)} · by {r.author ?? "unknown"}</p>
                        {r.note && <p className="mt-2 text-sm text-ink-2">&ldquo;{r.note}&rdquo;</p>}
                      </div>
                      {can(user.role, "packages.edit") && <VersionActions versionId={r.id} packageId={id} scheduled={r.isScheduled} canPublish={can(user.role, "packages.publish")} />}
                    </div>
                    {changes.length > 0 && (
                      <ul className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
                        {changes.slice(0, 12).map((c, i) => (
                          <li key={i} className="grid gap-1 px-3 py-2 sm:grid-cols-[170px_1fr]">
                            <span className="text-muted">{c.label}</span>
                            <span className="min-w-0 break-words"><span className="text-faint line-through">{c.before.slice(0, 100)}</span> <span className="text-ink">→ {c.after.slice(0, 100)}</span></span>
                          </li>
                        ))}
                        {changes.length > 12 && <li className="px-3 py-2 text-xs text-muted">and {changes.length - 12} more changes</li>}
                      </ul>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </PageBody>
    </>
  );
}
