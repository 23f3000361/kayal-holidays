import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/server/auth";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { LogForm } from "./log-form";

export const metadata: Metadata = { title: "Log an enquiry" };

export default async function NewEnquiryPage() {
  await requireUser("enquiries.log", "/admin/enquiries/new");
  return (
    <>
      <PageHeader
        back={<Link href="/admin/enquiries" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ChevronLeft size={16} /> Inbox</Link>}
        title="Log an enquiry"
        subtitle="For phone calls, WhatsApp chats and emails that didn't come through the website. It gets the same extraction, assignment and one-hour timer."
      />
      <PageBody className="max-w-3xl">
        <LogForm />
      </PageBody>
    </>
  );
}
