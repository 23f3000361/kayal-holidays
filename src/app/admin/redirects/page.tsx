import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listRedirects } from "@/server/redirects";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { RedirectManager } from "./redirect-manager";

export const metadata: Metadata = { title: "Old URLs" };
export const dynamic = "force-dynamic";

export default async function RedirectsPage() {
  await requireUser("redirects.manage", "/admin/redirects");
  const rows = await listRedirects();
  const broken = rows.filter((r) => r.broken).length;
  return (
    <>
      <PageHeader
        title="Old URLs"
        subtitle={<>Links from the old website that permanently redirect (308) to new pages, so Google rankings and bookmarks keep working. {rows.length} in place{broken ? <span className="text-danger">, {broken} pointing at a page that no longer exists</span> : ""}. Changes take effect within 30 seconds.</>}
      />
      <PageBody className="max-w-5xl">
        <RedirectManager rows={rows.map((r) => ({ id: r.id, from: r.fromPath, to: r.toPath, hits: r.hits, lastHitAt: r.lastHitAt?.toISOString() ?? null, broken: r.broken }))} />
      </PageBody>
    </>
  );
}
