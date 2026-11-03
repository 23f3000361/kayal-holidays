import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPackageForEditor } from "@/server/packages";
import { verifyPreview } from "@/server/signing";
import { PackageView } from "@/components/site/package-view";
import { PreviewBanner } from "@/components/site/preview-banner";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Draft preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Shareable, signed, expiring preview so the MD can review a draft on a phone without signing in. */
export default async function SharedPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string; s?: string }> }) {
  const { id } = await params;
  const { e, s } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  if (!verifyPreview(id, e, s)) {
    return <main className="flex min-h-dvh items-center justify-center"><EmptyState title="This preview link has expired or is not valid" body="Ask the content team for a fresh link." /></main>;
  }
  const ed = await getPackageForEditor(id);
  if (!ed) notFound();
  return (
    <main className="pb-24">
      <PreviewBanner code={ed.pkg.code} status={ed.status.label} />
      <PackageView content={ed.draft} slug={ed.pkg.slug} code={ed.pkg.code} preview />
    </main>
  );
}
