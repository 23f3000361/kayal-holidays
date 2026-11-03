import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { requireUser } from "@/server/auth";
import { adminListPackages } from "@/server/packages";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/pricing";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { PackageFilter } from "./package-filter";

export const metadata: Metadata = { title: "Packages" };
export const dynamic = "force-dynamic";

const TONE = { Published: "ok", Draft: "neutral", Unpublished: "neutral", "Changes not published": "warn" } as const;

export default async function PackagesAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser("packages.view", "/admin/packages");
  const { q } = await searchParams;
  const all = await adminListPackages();
  const needle = q?.trim().toLowerCase();
  const rows = needle ? all.filter((p) => `${p.title} ${p.code} ${p.region}`.toLowerCase().includes(needle)) : all;
  const canEdit = can(user.role, "packages.edit");

  return (
    <>
      <PageHeader
        title="Packages"
        subtitle={`${all.filter((p) => p.status.liveVersion).length} live · ${all.length} in total. Edits are saved as a draft and go live only when you publish.`}
        actions={canEdit && <Link href="/admin/packages/new" className={buttonClass("primary")}><Plus size={16} /> New package</Link>}
      />
      <PageBody>
        <PackageFilter defaultValue={q} />
        <Card className="mt-4 overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={<Package size={28} />} title={q ? "No packages match" : "No packages yet"} body={q ? "Try a code like PKG-KL-07 or a place name." : "Create your first package to get started."} action={!q && canEdit ? <Link href="/admin/packages/new" className={buttonClass("primary")}>New package</Link> : undefined} />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/packages/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper sm:px-5">
                    <div className="relative hidden h-14 w-20 shrink-0 overflow-hidden rounded-md bg-sand sm:block">
                      {p.cover && <Image src={p.cover} alt="" fill sizes="80px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{p.title || "Untitled package"}</p>
                      <p className="tabular text-xs text-muted">{p.code} · {p.region} · {p.days} days{p.fromPrice ? ` · from ${formatINR(p.fromPrice)}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={TONE[p.status.label]}>{p.status.label}{p.status.liveVersion ? ` · v${p.status.liveVersion}` : ""}</Badge>
                      {p.status.scheduledAt && <span className="text-xs text-info">Scheduled {p.status.scheduledAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</span>}
                    </div>
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
