import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getPackageForEditor } from "@/server/packages";
import { PackageView } from "@/components/site/package-view";
import { PreviewBanner } from "@/components/site/preview-banner";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Renders the draft with exactly the component the live page uses. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser("packages.view", `/admin/packages/${id}/preview`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ed = await getPackageForEditor(id);
  if (!ed) notFound();
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper pb-24">
      <PreviewBanner code={ed.pkg.code} status={ed.status.label} backHref={`/admin/packages/${id}`} />
      <PackageView content={ed.draft} slug={ed.pkg.slug} code={ed.pkg.code} preview />
    </div>
  );
}
