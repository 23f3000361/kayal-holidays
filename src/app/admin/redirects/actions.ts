"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authorize, ActionError } from "@/server/auth";
import { addRedirects, checkImport, deleteRedirects } from "@/server/redirects";
import { parseCsv } from "@/lib/redirects";
import type { ActionResult } from "@/app/admin/actions";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActionError || e instanceof z.ZodError) return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

const text = z.string().max(200_000, "That list is too long; split it into parts.");

/** Dry run: what would happen if this list were imported. */
export async function previewImportAction(csv: string) {
  return run(async () => {
    await authorize("redirects.manage");
    const { rows, issues } = parseCsv(text.parse(csv));
    if (rows.length > 2000) throw new ActionError("Import at most 2,000 rows at a time.");
    const checked = await checkImport(rows);
    return { ok: checked.ok, issues: [...issues, ...checked.issues].sort((a, b) => a.line - b.line) };
  });
}

export async function importAction(csv: string) {
  return run(async () => {
    const user = await authorize("redirects.manage");
    const { rows, issues } = parseCsv(text.parse(csv));
    const r = await addRedirects(rows, user);
    revalidatePath("/admin/redirects");
    return { added: r.added, skipped: issues.length + r.issues.length };
  });
}

export async function addOneAction(from: string, to: string) {
  return run(async () => {
    const user = await authorize("redirects.manage");
    const r = await addRedirects([{ from: z.string().max(300).parse(from), to: z.string().max(300).parse(to) }], user);
    if (r.issues.length) throw new ActionError(r.issues[0].error);
    revalidatePath("/admin/redirects");
    return r.added;
  });
}

export async function deleteAction(ids: string[]) {
  return run(async () => {
    const user = await authorize("redirects.manage");
    const n = await deleteRedirects(z.array(z.string().uuid()).max(2000).parse(ids), user);
    revalidatePath("/admin/redirects");
    return n;
  });
}
