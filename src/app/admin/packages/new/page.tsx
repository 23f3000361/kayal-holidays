import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/server/auth";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { NewPackageForm } from "./form";

export const metadata: Metadata = { title: "New package" };

export default async function NewPackagePage() {
  await requireUser("packages.edit", "/admin/packages/new");
  return (
    <>
      <PageHeader back={<Link href="/admin/packages" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Packages</Link>} title="New package" subtitle="Start with the basics. You can fill in everything else in the editor; nothing goes live until you publish." />
      <PageBody className="max-w-xl">
        <NewPackageForm />
      </PageBody>
    </>
  );
}
