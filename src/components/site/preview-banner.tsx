import Link from "next/link";
import { Eye } from "lucide-react";

export function PreviewBanner({ code, status, backHref }: { code: string; status: string; backHref?: string }) {
  return (
    <div className="sticky top-0 z-50 bg-ink text-white">
      <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
        <p className="flex items-center gap-2"><Eye size={15} /> Preview of the draft of {code}. This is not live. <span className="text-white/60">Status: {status}</span></p>
        {backHref && <Link href={backHref} className="rounded-md bg-white/10 px-3 py-1 hover:bg-white/20">Back to editor</Link>}
      </div>
    </div>
  );
}
