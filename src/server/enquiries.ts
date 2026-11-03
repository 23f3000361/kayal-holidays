import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Channel, EnquiryStatus } from "@/db/schema";
import { extractRules, overallConfidence, type Extraction, type ExtractedFields, type FieldKey } from "@/lib/ai/extract";
import { askLlm, mergeLlm } from "@/lib/ai/llm";
import { suggestPackages, type Suggestion } from "@/lib/ai/suggest";
import { draftReply, ACK_TEMPLATE, fillTemplate } from "@/lib/ai/draft";
import { pickConsultant } from "@/lib/assign";
import { dueAt } from "@/lib/sla";
import { priceParty } from "@/lib/pricing";
import { can, canSeeEnquiry } from "@/lib/permissions";
import { getLivePackages } from "./packages";
import { audit } from "./audit";
import { ActionError, type CurrentUser } from "./auth";

export const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function nextCounter(name: "enquiry" | "quote", start: number) {
  const rows = await db
    .insert(s.counters)
    .values({ name, value: start })
    .onConflictDoUpdate({ target: s.counters.name, set: { value: sql`${s.counters.value} + 1` } })
    .returning({ value: s.counters.value });
  return rows[0].value;
}

/** Rules engine always; language model as a second opinion when configured. */
export async function analyse(message: string, at: Date): Promise<Extraction> {
  const rules = extractRules(message, at);
  const llm = await askLlm(message, at);
  return mergeLlm(rules, llm, message);
}

/** Structured form values are what the traveller typed, so they outrank anything inferred. */
function applyFormValues(ex: Extraction, form: { date?: string | null; adults?: number | null; children?: number | null }): Extraction {
  const f = { ...ex.fields };
  if (form.adults) f.adults = { value: form.adults, confidence: 1, evidence: [], note: "From the form" };
  if (form.children !== null && form.children !== undefined && (form.children > 0 || !f.children)) f.children = { value: form.children, confidence: 1, evidence: [], note: "From the form" };
  if (form.date) f.travelDates = { value: { start: form.date, end: f.travelDates?.value.end ?? null, month: form.date.slice(0, 7), flexible: false }, confidence: 1, evidence: [], note: "From the form" };
  const questions = ex.questions.filter((q) => !(form.adults && q.startsWith("How many adults")) && !(form.date && (q.startsWith("When would") || q.startsWith("Which dates"))));
  return { ...ex, fields: f, questions };
}

export type NewEnquiry = {
  channel: Channel;
  name: string;
  email?: string | null;
  phone?: string | null;
  message: string;
  packageId?: string | null;
  formDate?: string | null;
  formAdults?: number | null;
  formChildren?: number | null;
  consentContact: boolean;
  consentWhatsapp: boolean;
  travellerId?: string | null;
};

export async function createEnquiry(input: NewEnquiry, actor: CurrentUser | null) {
  const now = new Date();
  const extraction = applyFormValues(await analyse(input.message, now), { date: input.formDate, adults: input.formAdults, children: input.formChildren });

  const consultants = await db.select({ id: s.users.id, name: s.users.name, lastAssignedAt: s.users.lastAssignedAt }).from(s.users).where(and(eq(s.users.role, "consultant"), eq(s.users.active, true)));
  const open = await db.select({ id: s.enquiries.assignedToId, n: sql<number>`count(*)` }).from(s.enquiries).where(inArray(s.enquiries.status, ["new", "replied", "quoted"])).groupBy(s.enquiries.assignedToId);
  const pick = pickConsultant(consultants.map((c) => ({ ...c, open: open.find((o) => o.id === c.id)?.n ?? 0 })));

  const ref = `ENQ-${await nextCounter("enquiry", 10001)}`;
  const [enq] = await db
    .insert(s.enquiries)
    .values({
      ref, channel: input.channel, packageId: input.packageId ?? null, travellerId: input.travellerId ?? null,
      name: input.name, email: input.email || null, phone: input.phone || null, message: input.message,
      formDate: input.formDate ?? null, formAdults: input.formAdults ?? null, formChildren: input.formChildren ?? null,
      consentContact: input.consentContact, consentWhatsapp: input.consentWhatsapp,
      assignedToId: pick?.id ?? null, extraction, dueAt: dueAt(now), createdAt: now, updatedAt: now,
    })
    .returning();
  if (pick) await db.update(s.users).set({ lastAssignedAt: now }).where(eq(s.users.id, pick.id));

  const events: (typeof s.enquiryEvents.$inferInsert)[] = [{ enquiryId: enq.id, type: "received", body: actor ? `Logged from ${input.channel} by ${actor.name}` : `Received by ${input.channel}`, actorId: actor?.id ?? null }];

  // Instant acknowledgement from a fixed template (mock delivery: stored in the outbox).
  const vars = { name: input.name.split(" ")[0] || "there", ref };
  const ackTo = input.email ? { channel: "email" as const, to: input.email } : input.phone && input.consentWhatsapp ? { channel: "whatsapp" as const, to: input.phone } : null;
  if (ackTo) {
    await db.insert(s.messages).values({ enquiryId: enq.id, channel: ackTo.channel, to: ackTo.to, subject: fillTemplate(ACK_TEMPLATE.subject, vars), body: fillTemplate(ACK_TEMPLATE.body, vars), kind: "ack" });
    events.push({ enquiryId: enq.id, type: "ack", body: `Automatic acknowledgement sent by ${ackTo.channel}` });
  }
  events.push({ enquiryId: enq.id, type: "ai", body: `Details extracted (${extraction.engine}), ${Math.round(overallConfidence(extraction.fields) * 100)}% complete` });
  if (pick) events.push({ enquiryId: enq.id, type: "assign", body: `Assigned to ${pick.name} (lightest load)` });
  await db.insert(s.enquiryEvents).values(events);
  if (actor) await audit(actor.id, "enquiry.log", "enquiry", enq.id, `Logged ${ref} from ${input.channel}`);
  return { ref, id: enq.id, ackChannel: ackTo?.channel ?? null };
}

// ---------------------------------------------------------------------------------------------
// Reading

/** Extraction with any consultant corrections applied on top. */
export function effectiveFields(ex: Extraction | null, confirmed: Partial<Record<string, unknown>> | null): ExtractedFields {
  const base: ExtractedFields = ex?.fields ?? extractRules("").fields;
  if (!confirmed) return base;
  const out = { ...base } as Record<FieldKey, unknown>;
  for (const [k, v] of Object.entries(confirmed) as [FieldKey, unknown][]) {
    out[k] = v === null || v === undefined || (Array.isArray(v) && v.length === 0) ? null : { value: v, confidence: 1, evidence: base[k]?.evidence ?? [], note: "Checked by a consultant" };
  }
  return out as ExtractedFields;
}

export type InboxFilter = { view?: "open" | "mine" | "unassigned" | "closed" | "all"; q?: string; channel?: Channel };

const OPEN: EnquiryStatus[] = ["new", "replied", "quoted"];

export async function listInbox(user: CurrentUser, filter: InboxFilter) {
  const conds: SQL[] = [];
  if (!can(user.role, "enquiries.viewAll")) conds.push(or(eq(s.enquiries.assignedToId, user.id), isNull(s.enquiries.assignedToId))!);
  const view = filter.view ?? "open";
  if (view === "open") conds.push(inArray(s.enquiries.status, OPEN));
  if (view === "mine") conds.push(eq(s.enquiries.assignedToId, user.id), inArray(s.enquiries.status, OPEN));
  if (view === "unassigned") conds.push(isNull(s.enquiries.assignedToId), inArray(s.enquiries.status, OPEN));
  if (view === "closed") conds.push(inArray(s.enquiries.status, ["booked", "lost", "spam"]));
  if (filter.channel) conds.push(eq(s.enquiries.channel, filter.channel));
  if (filter.q?.trim()) {
    const q = `%${filter.q.trim().replace(/[%_]/g, "")}%`;
    conds.push(or(like(s.enquiries.name, q), like(s.enquiries.message, q), like(s.enquiries.ref, q), like(s.enquiries.email, q))!);
  }
  const rows = await db
    .select({ e: s.enquiries, assignee: s.users.name })
    .from(s.enquiries)
    .leftJoin(s.users, eq(s.users.id, s.enquiries.assignedToId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.enquiries.createdAt))
    .limit(200);
  return rows.map(({ e, assignee }) => ({
    id: e.id, ref: e.ref, name: e.name, channel: e.channel, status: e.status, message: e.message, assignee, assignedToId: e.assignedToId,
    createdAt: e.createdAt, firstReplyAt: e.firstReplyAt, fields: effectiveFields(e.extraction, e.confirmed ?? null), confirmed: !!e.confirmedAt,
  }));
}

export async function inboxCounts(user: CurrentUser) {
  const scope = can(user.role, "enquiries.viewAll") ? undefined : or(eq(s.enquiries.assignedToId, user.id), isNull(s.enquiries.assignedToId));
  const rows = await db.select({ status: s.enquiries.status, assigned: s.enquiries.assignedToId, firstReplyAt: s.enquiries.firstReplyAt, dueAt: s.enquiries.dueAt }).from(s.enquiries).where(scope);
  const now = Date.now();
  const open = rows.filter((r) => OPEN.includes(r.status));
  return {
    open: open.length,
    unanswered: open.filter((r) => !r.firstReplyAt).length,
    overdue: open.filter((r) => !r.firstReplyAt && r.dueAt.getTime() < now).length,
    mine: open.filter((r) => r.assigned === user.id).length,
    unassigned: open.filter((r) => !r.assigned).length,
  };
}

async function loadVisible(id: string, user: CurrentUser) {
  const [e] = await db.select().from(s.enquiries).where(eq(s.enquiries.id, id)).limit(1);
  if (!e || !canSeeEnquiry(user, e)) return null;
  return e;
}

export async function getEnquiryDetail(id: string, user: CurrentUser) {
  const e = await loadVisible(id, user);
  if (!e) return null;
  const [events, msgs, quotes, staff, live] = await Promise.all([
    db.select({ ev: s.enquiryEvents, actor: s.users.name }).from(s.enquiryEvents).leftJoin(s.users, eq(s.users.id, s.enquiryEvents.actorId)).where(eq(s.enquiryEvents.enquiryId, id)).orderBy(desc(s.enquiryEvents.createdAt)),
    db.select().from(s.messages).where(eq(s.messages.enquiryId, id)).orderBy(desc(s.messages.createdAt)),
    db.select({ q: s.quotes, code: s.packages.code }).from(s.quotes).innerJoin(s.packages, eq(s.packages.id, s.quotes.packageId)).where(eq(s.quotes.enquiryId, id)).orderBy(desc(s.quotes.createdAt)),
    db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.users).where(and(inArray(s.users.role, ["consultant", "admin"]), eq(s.users.active, true))),
    getLivePackages(),
  ]);
  const fields = effectiveFields(e.extraction, e.confirmed ?? null);
  const requested = e.packageId ? live.find((p) => p.id === e.packageId) : undefined;
  let suggestions: Suggestion[] = suggestPackages(fields, live);
  // A package the traveller enquired from is always shown, even if it scores lower.
  if (requested && !suggestions.some((x) => x.packageId === requested.id)) {
    const own = suggestPackages(fields, [requested])[0];
    suggestions = [own, ...suggestions.slice(0, 2)];
  }
  const assignee = staff.find((u) => u.id === e.assignedToId);
  const draft = draftReply({ name: e.name, fields, suggestions, questions: e.confirmedAt ? [] : (e.extraction?.questions ?? []), consultantName: assignee?.name ?? user.name, siteUrl: siteUrl() });
  return {
    enquiry: e,
    extraction: e.extraction,
    fields,
    events: events.map((x) => ({ ...x.ev, actor: x.actor })),
    messages: msgs,
    quotes: quotes.map((x) => ({ ...x.q, code: x.code })),
    staff,
    suggestions,
    draft,
    requestedPackage: requested ? { id: requested.id, title: requested.content.title, slug: requested.slug } : null,
    livePackages: live.map((p) => ({ id: p.id, code: p.code, title: p.content.title, durationDays: p.content.durationDays })),
  };
}

// ---------------------------------------------------------------------------------------------
// Working an enquiry

async function event(enquiryId: string, type: (typeof s.enquiryEvents.$inferInsert)["type"], body: string, actorId: string) {
  await db.insert(s.enquiryEvents).values({ enquiryId, type, body, actorId });
  await db.update(s.enquiries).set({ updatedAt: new Date() }).where(eq(s.enquiries.id, enquiryId));
}

async function workable(id: string, user: CurrentUser) {
  const e = await loadVisible(id, user);
  if (!e) throw new ActionError("Enquiry not found.");
  return e;
}

export async function confirmFields(id: string, values: Partial<Record<FieldKey, unknown>>, user: CurrentUser) {
  const e = await workable(id, user);
  const before = effectiveFields(e.extraction, e.confirmed ?? null);
  const changed = (Object.keys(values) as FieldKey[]).filter((k) => JSON.stringify(before[k]?.value ?? null) !== JSON.stringify(values[k] ?? null));
  await db.update(s.enquiries).set({ confirmed: { ...(e.confirmed ?? {}), ...values }, confirmedById: user.id, confirmedAt: new Date() }).where(eq(s.enquiries.id, id));
  await event(id, "correction", changed.length ? `Corrected ${changed.join(", ")}` : "Confirmed extracted details", user.id);
}

export async function sendReply(id: string, input: { channel: "email" | "whatsapp"; subject: string; body: string }, user: CurrentUser) {
  const e = await workable(id, user);
  if (input.channel === "whatsapp" && !e.consentWhatsapp) throw new ActionError("This traveller has not agreed to WhatsApp messages. Reply by email instead.");
  const to = input.channel === "email" ? e.email : e.phone;
  if (!to) throw new ActionError(input.channel === "email" ? "No email address on this enquiry." : "No phone number on this enquiry.");
  await db.insert(s.messages).values({ enquiryId: id, channel: input.channel, to, subject: input.subject, body: input.body, kind: "reply", sentById: user.id });
  const patch: Partial<typeof s.enquiries.$inferInsert> = { updatedAt: new Date() };
  if (!e.firstReplyAt) patch.firstReplyAt = new Date();
  if (e.status === "new") patch.status = "replied";
  if (!e.assignedToId) patch.assignedToId = user.id;
  await db.update(s.enquiries).set(patch).where(eq(s.enquiries.id, id));
  await event(id, "reply", `Reply sent by ${input.channel} to ${to}`, user.id);
  await audit(user.id, "enquiry.reply", "enquiry", id, `Replied to ${e.ref} by ${input.channel}`);
}

export async function addNote(id: string, body: string, user: CurrentUser) {
  await workable(id, user);
  await event(id, "note", body, user.id);
}

export async function setStatus(id: string, status: EnquiryStatus, user: CurrentUser) {
  const e = await workable(id, user);
  if (e.status === status) return;
  await db.update(s.enquiries).set({ status }).where(eq(s.enquiries.id, id));
  await event(id, "status", `Status changed from ${e.status} to ${status}`, user.id);
  await audit(user.id, "enquiry.status", "enquiry", id, `${e.ref}: ${e.status} → ${status}`);
}

export async function assignEnquiry(id: string, assigneeId: string | null, user: CurrentUser) {
  const e = await workable(id, user);
  const self = assigneeId === user.id && !e.assignedToId;
  if (!self && !can(user.role, "enquiries.assign")) throw new ActionError("Only an admin can reassign enquiries.");
  let name = "nobody";
  if (assigneeId) {
    const [u] = await db.select().from(s.users).where(eq(s.users.id, assigneeId)).limit(1);
    if (!u || !["consultant", "admin"].includes(u.role)) throw new ActionError("That person can't take enquiries.");
    name = u.name;
  }
  await db.update(s.enquiries).set({ assignedToId: assigneeId }).where(eq(s.enquiries.id, id));
  if (assigneeId) await db.update(s.users).set({ lastAssignedAt: new Date() }).where(eq(s.users.id, assigneeId));
  await event(id, "assign", self ? `${user.name} took this enquiry` : `Assigned to ${name}`, user.id);
  await audit(user.id, "enquiry.assign", "enquiry", id, `${e.ref} assigned to ${name}`);
}

export async function createQuote(id: string, input: { packageId: string; travelDate: string; adults: number; children: number; note: string }, user: CurrentUser) {
  const e = await workable(id, user);
  const live = (await getLivePackages()).find((p) => p.id === input.packageId);
  if (!live) throw new ActionError("That package is not live, so it can't be quoted.");
  // The price always comes from the live package's price table.
  const price = priceParty(live.content, input.travelDate, { adults: input.adults, children: input.children });
  if (!price) throw new ActionError("This package has no price for that date. Pick another date or package.");
  const [version] = await db.select({ id: s.packageVersions.id }).from(s.packageVersions).where(and(eq(s.packageVersions.packageId, live.id), eq(s.packageVersions.kind, "release"), eq(s.packageVersions.versionNo, live.versionNo))).limit(1);
  const n = await nextCounter("quote", 1);
  const ref = `Q-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
  const token = randomBytes(18).toString("base64url");
  const validUntil = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await db.insert(s.quotes).values({ ref, token, enquiryId: id, packageId: live.id, versionId: version.id, travelDate: input.travelDate, adults: input.adults, children: input.children, price, note: input.note.trim().slice(0, 500), validUntil, createdById: user.id });
  if (["new", "replied"].includes(e.status)) await db.update(s.enquiries).set({ status: "quoted" }).where(eq(s.enquiries.id, id));
  await event(id, "quote", `Quote ${ref} created for ${live.code}`, user.id);
  await audit(user.id, "quote.create", "enquiry", id, `Quote ${ref} for ${e.ref}`);
  return { ref, token };
}

export async function getQuoteByToken(token: string) {
  const [row] = await db
    .select({ q: s.quotes, e: s.enquiries, v: s.packageVersions, p: s.packages, by: s.users.name })
    .from(s.quotes)
    .innerJoin(s.enquiries, eq(s.enquiries.id, s.quotes.enquiryId))
    .innerJoin(s.packageVersions, eq(s.packageVersions.id, s.quotes.versionId))
    .innerJoin(s.packages, eq(s.packages.id, s.quotes.packageId))
    .leftJoin(s.users, eq(s.users.id, s.quotes.createdById))
    .where(eq(s.quotes.token, token))
    .limit(1);
  return row ?? null;
}

export async function travellerEnquiries(userId: string) {
  const rows = await db.select().from(s.enquiries).where(eq(s.enquiries.travellerId, userId)).orderBy(desc(s.enquiries.createdAt));
  const ids = rows.map((r) => r.id);
  const [msgs, quotes] = ids.length
    ? await Promise.all([
        db.select().from(s.messages).where(inArray(s.messages.enquiryId, ids)).orderBy(desc(s.messages.createdAt)),
        db.select({ q: s.quotes, title: s.packageVersions.content }).from(s.quotes).innerJoin(s.packageVersions, eq(s.packageVersions.id, s.quotes.versionId)).where(inArray(s.quotes.enquiryId, ids)),
      ])
    : [[], []];
  return rows.map((r) => ({
    ...r,
    messages: msgs.filter((m) => m.enquiryId === r.id),
    quotes: quotes.filter((q) => q.q.enquiryId === r.id).map((q) => ({ ...q.q, title: q.title.title })),
  }));
}
