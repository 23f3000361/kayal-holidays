"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authorize, ActionError } from "@/server/auth";
import * as pk from "@/server/packages";
import * as enq from "@/server/enquiries";
import { signPreview } from "@/server/signing";
import { CHANNELS, STATUSES } from "@/lib/constants";
import { REGIONS, THEMES } from "@/lib/package-content";
import type { FieldKey } from "@/lib/ai/extract";
import { conflictMessage } from "@/lib/conflict";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: { path: string; message: string }[] };

async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn(), message };
  } catch (e) {
    if (e instanceof ActionError || e instanceof z.ZodError) return { ok: false, error: e instanceof z.ZodError ? e.issues[0].message : e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirect() through
    console.error(e);
    return { ok: false, error: "Something went wrong. Nothing was changed. Please try again." };
  }
}

const uuid = z.string().uuid();

// ---------------- Packages ----------------

export async function saveDraftAction(id: string, content: unknown, baseHash?: string): Promise<ActionResult<{ hash: string }> & { conflict?: boolean }> {
  const user = await authorize("packages.edit");
  const res = await pk.saveDraft(uuid.parse(id), content, user, baseHash ? z.string().max(32).parse(baseHash) : undefined);
  if (!res.ok && res.conflict) return { ok: false, conflict: true, error: conflictMessage(res.conflict) };
  if (!res.ok) return { ok: false, error: "Some fields need attention.", fieldErrors: res.errors };
  revalidatePath(`/admin/packages/${id}`);
  revalidatePath("/admin/packages");
  return { ok: true, message: "Draft saved", data: { hash: res.hash } };
}

export async function publishAction(id: string, input: { publishAt?: string; note: string }) {
  return run(async () => {
    const user = await authorize("packages.publish");
    const when = input.publishAt ? new Date(input.publishAt) : undefined;
    if (when && Number.isNaN(when.getTime())) throw new ActionError("That date and time is not valid.");
    const r = await pk.publishDraft(uuid.parse(id), { publishAt: when, note: z.string().max(200).parse(input.note) }, user);
    revalidatePath(`/admin/packages/${id}`, "layout");
    revalidatePath("/admin/packages");
    return r;
  });
}

export async function unpublishAction(id: string) {
  return run(async () => {
    const user = await authorize("packages.publish");
    await pk.unpublish(uuid.parse(id), user);
    revalidatePath(`/admin/packages/${id}`, "layout");
  }, "Taken off the website");
}

export async function cancelScheduledAction(versionId: string, packageId: string) {
  return run(async () => {
    const user = await authorize("packages.publish");
    await pk.cancelScheduled(uuid.parse(versionId), user);
    revalidatePath(`/admin/packages/${packageId}`, "layout");
  }, "Scheduled release cancelled");
}

export async function restoreAction(versionId: string) {
  return run(async () => {
    const user = await authorize("packages.edit");
    const packageId = await pk.restoreToDraft(uuid.parse(versionId), user);
    revalidatePath(`/admin/packages/${packageId}`, "layout");
    return packageId;
  }, "Copied into the draft. Review it, then publish.");
}

export async function duplicateAction(id: string) {
  const user = await authorize("packages.edit");
  const newId = await pk.duplicatePackage(uuid.parse(id), user);
  revalidatePath("/admin/packages");
  redirect(`/admin/packages/${newId}?duplicated=1`);
}

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^PKG-[A-Z]{2}-\d{2,3}(-[A-Z0-9]+)?$/, "Use the format PKG-KL-07"),
  title: z.string().trim().min(3, "Give the package a title").max(120),
  region: z.enum(REGIONS),
});

export async function createPackageAction(_: unknown, form: FormData): Promise<ActionResult> {
  const user = await authorize("packages.edit");
  const parsed = createSchema.safeParse({ code: form.get("code"), title: form.get("title"), region: form.get("region") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  let id: string;
  try {
    id = await pk.createPackage(parsed.data, user);
  } catch (e) {
    return { ok: false, error: e instanceof ActionError ? e.message : "Could not create the package." };
  }
  redirect(`/admin/packages/${id}`);
}

export async function identityAction(id: string, input: { code: string; slug: string }) {
  return run(async () => {
    const user = await authorize("packages.edit");
    const code = createSchema.shape.code.parse(input.code);
    await pk.updateIdentity(uuid.parse(id), { code, slug: z.string().min(3).max(80).parse(input.slug) }, user);
    revalidatePath(`/admin/packages/${id}`, "layout");
  }, "Saved");
}

export async function previewLinkAction(id: string) {
  return run(async () => {
    await authorize("packages.view");
    const { exp, sig } = signPreview(uuid.parse(id));
    return `${enq.siteUrl()}/preview/${id}?e=${exp}&s=${sig}`;
  });
}

// ---------------- Enquiries ----------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const fieldValues = z
  .object({
    adults: z.number().int().min(1).max(200).nullable(),
    children: z.number().int().min(0).max(50).nullable(),
    travelDates: z.object({ start: isoDate.nullable(), end: isoDate.nullable(), month: z.string().regex(/^\d{4}-\d{2}$/).nullable(), flexible: z.boolean() }).nullable(),
    nights: z.object({ min: z.number().int().min(1).max(60), max: z.number().int().min(1).max(60) }).refine((n) => n.max >= n.min, "Max nights must be at least min nights").nullable(),
    destinations: z.array(z.string().trim().min(1).max(40)).max(12).nullable(),
    budget: z.object({ amount: z.number().positive().max(100_000_000), currency: z.enum(["INR", "USD", "EUR", "GBP"]), basis: z.enum(["total", "per_person"]), limit: z.enum(["around", "max", "exact"]), inr: z.number().positive() }).nullable(),
    mustHaves: z.array(z.enum(THEMES)).nullable(),
    interests: z.array(z.enum(THEMES)).nullable(),
    hotelCategory: z.string().max(20).nullable(),
  })
  .partial();

export async function confirmFieldsAction(id: string, values: unknown) {
  return run(async () => {
    const user = await authorize("enquiries.work");
    const parsed = fieldValues.parse(values) as Partial<Record<FieldKey, unknown>>;
    await enq.confirmFields(uuid.parse(id), parsed, user);
    revalidatePath(`/admin/enquiries/${id}`);
  }, "Details confirmed. Suggestions and draft updated.");
}

export async function sendReplyAction(id: string, input: { channel: "email" | "whatsapp"; subject: string; body: string }) {
  return run(async () => {
    const user = await authorize("enquiries.work");
    const v = z.object({ channel: z.enum(["email", "whatsapp"]), subject: z.string().trim().max(200), body: z.string().trim().min(20, "The reply looks empty").max(10_000) }).parse(input);
    await enq.sendReply(uuid.parse(id), v, user);
    revalidatePath(`/admin/enquiries/${id}`);
    revalidatePath("/admin/enquiries");
    revalidatePath("/admin");
  }, "Reply sent (simulated: stored in the outbox)");
}

export async function noteAction(id: string, body: string) {
  return run(async () => {
    const user = await authorize("enquiries.work");
    await enq.addNote(uuid.parse(id), z.string().trim().min(1, "Write a note first").max(2000).parse(body), user);
    revalidatePath(`/admin/enquiries/${id}`);
  }, "Note added");
}

export async function statusAction(id: string, status: string) {
  return run(async () => {
    const user = await authorize("enquiries.work");
    await enq.setStatus(uuid.parse(id), z.enum(STATUSES).parse(status), user);
    revalidatePath(`/admin/enquiries/${id}`);
    revalidatePath("/admin/enquiries");
  }, "Status updated");
}

export async function assignAction(id: string, assigneeId: string | null) {
  return run(async () => {
    const user = await authorize("enquiries.work");
    await enq.assignEnquiry(uuid.parse(id), assigneeId ? uuid.parse(assigneeId) : null, user);
    revalidatePath(`/admin/enquiries/${id}`);
    revalidatePath("/admin/enquiries");
  }, "Assignment updated");
}

export async function quoteAction(id: string, input: { packageId: string; travelDate: string; adults: number; children: number; note: string }) {
  return run(async () => {
    const user = await authorize("quotes.create");
    const v = z.object({ packageId: uuid, travelDate: isoDate, adults: z.number().int().min(1).max(60), children: z.number().int().min(0).max(30), note: z.string().max(500) }).parse(input);
    const q = await enq.createQuote(uuid.parse(id), v, user);
    revalidatePath(`/admin/enquiries/${id}`);
    return q;
  }, "Quote created");
}

const logSchema = z.object({
  channel: z.enum(CHANNELS),
  name: z.string().trim().min(2, "Enter the traveller's name").max(80),
  email: z.union([z.string().trim().toLowerCase().email("Enter a valid email"), z.literal("")]),
  phone: z.union([z.string().trim().regex(/^\+?[\d\s()-]{8,20}$/, "Enter a valid phone number"), z.literal("")]),
  message: z.string().trim().min(5, "Paste or type the message").max(5000),
  whatsapp: z.boolean(),
});

export async function logEnquiryAction(input: unknown) {
  return run(async () => {
    const user = await authorize("enquiries.log");
    const v = logSchema.parse(input);
    if (!v.email && !v.phone) throw new ActionError("Add an email or a phone number so we can reply.");
    const r = await enq.createEnquiry({ channel: v.channel, name: v.name, email: v.email || null, phone: v.phone || null, message: v.message, consentContact: true, consentWhatsapp: v.whatsapp && !!v.phone }, user);
    revalidatePath("/admin/enquiries");
    return r.id;
  });
}
