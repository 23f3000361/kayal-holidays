"use client";

import { useActionState } from "react";
import { createPackageAction, type ActionResult } from "@/app/admin/actions";
import { REGIONS } from "@/lib/package-content";
import { Alert, Card, Field, Spinner, buttonClass, inputClass } from "@/components/ui";

export function NewPackageForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createPackageAction, null);
  return (
    <Card className="p-5 sm:p-6">
      <form action={action} className="space-y-5">
        {state && !state.ok && <Alert tone="danger">{state.error}</Alert>}
        <Field label="Package code" htmlFor="code" hint="Format PKG-KL-07: KL Kerala, TN Tamil Nadu, KA Karnataka, SI multi-state">
          <input id="code" name="code" required placeholder="PKG-KL-24" className={`${inputClass} uppercase`} />
        </Field>
        <Field label="Title" htmlFor="title" hint="This also sets the web address, e.g. /packages/munnar-tea-trails">
          <input id="title" name="title" required placeholder="Munnar tea trails" className={inputClass} />
        </Field>
        <Field label="Region" htmlFor="region">
          <select id="region" name="region" className={inputClass}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <button className={buttonClass("primary")} disabled={pending}>{pending && <Spinner />} Create and edit</button>
      </form>
    </Card>
  );
}
