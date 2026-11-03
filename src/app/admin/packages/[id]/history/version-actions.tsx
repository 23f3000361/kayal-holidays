"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelScheduledAction, restoreAction } from "@/app/admin/actions";
import { Button, Spinner } from "@/components/ui";

export function VersionActions({ versionId, packageId, scheduled, canPublish }: { versionId: string; packageId: string; scheduled: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Spinner className="text-muted" />}
      {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => { if (confirm("Replace the current draft with this version? Unpublished draft changes will be lost.")) start(async () => { const r = await restoreAction(versionId); if (r.ok) router.push(`/admin/packages/${packageId}`); else setMsg(r.error); }); }}>
        Copy into draft
      </Button>
      {scheduled && canPublish && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => { const r = await cancelScheduledAction(versionId, packageId); setMsg(r.ok ? "Cancelled" : r.error); router.refresh(); })}>
          Cancel schedule
        </Button>
      )}
    </div>
  );
}
