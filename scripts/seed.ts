/**
 * Creates the schema and loads demo data. Safe to re-run with --reset.
 *   npm run db:setup          (migrate + seed if empty)
 *   npm run db:reset          (wipe and re-seed)
 * All people, emails and phone numbers are fictional (example.com, 555-style numbers).
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import * as s from "../src/db/schema";
import { SEED_PACKAGES } from "../src/data/packages";
import { SEED_POSTS } from "../src/data/posts";
import LEGACY from "../src/data/legacy-redirects.json";
import { normalizePath } from "../src/lib/redirects";
import { extractRules } from "../src/lib/ai/extract";
import { dueAt } from "../src/lib/sla";
import { priceParty } from "../src/lib/pricing";
import { draftReply, ACK_TEMPLATE, fillTemplate } from "../src/lib/ai/draft";
import { suggestPackages } from "../src/lib/ai/suggest";

const url = process.env.DATABASE_URL ?? "file:./data/kayal.db";
if (url.startsWith("file:")) fs.mkdirSync("data", { recursive: true });
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const db = drizzle(client, { schema: s });

export const DEMO_PASSWORD = "kayal-demo-2026";
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const now = Date.now();
const ago = (ms: number) => new Date(now - ms);

async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
  const reset = process.argv.includes("--reset");
  const existing = await db.select({ n: sql<number>`count(*)` }).from(s.users);
  if (existing[0].n > 0 && !reset) {
    console.log("Database already seeded. Use --reset to start over.");
    return;
  }
  if (reset) {
    for (const t of [s.redirects, s.blogPosts, s.auditLog, s.quotes, s.messages, s.enquiryEvents, s.enquiries, s.media, s.packageVersions, s.packages, s.sessions, s.users, s.counters]) await db.delete(t);
  }

  // ---- People -------------------------------------------------------------
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const people = [
    { key: "admin", email: "admin@example.com", name: "Meera Nair", role: "admin" as const },
    { key: "editor", email: "editor@example.com", name: "Thomas Varghese", role: "editor" as const },
    { key: "anjali", email: "anjali@example.com", name: "Anjali Pillai", role: "consultant" as const },
    { key: "rahul", email: "rahul@example.com", name: "Rahul Menon", role: "consultant" as const },
    { key: "fatima", email: "fatima@example.com", name: "Fatima Rasheed", role: "consultant" as const },
    { key: "traveller", email: "traveller@example.com", name: "Priya Sharma", role: "traveller" as const, phone: "+91 98470 00011" },
  ];
  const U: Record<string, string> = {};
  for (const p of people) {
    const [row] = await db.insert(s.users).values({ email: p.email, name: p.name, role: p.role, passwordHash: hash, phone: p.phone ?? null, createdAt: ago(90 * DAY) }).returning();
    U[p.key] = row.id;
  }

  // ---- Packages and version history ----------------------------------------
  const PKG: Record<string, { id: string; releaseId?: string; content: (typeof SEED_PACKAGES)[number]["content"] }> = {};
  for (const sp of SEED_PACKAGES) {
    const [pkg] = await db.insert(s.packages).values({ code: sp.code, slug: sp.slug, createdAt: ago(80 * DAY), updatedAt: ago(10 * DAY) }).returning();
    PKG[sp.code] = { id: pkg.id, content: sp.content };
    let draft = sp.content;

    if (sp.status === "published") {
      if (sp.code === "PKG-KL-07") {
        // History: imported from the old site, then a monsoon price revision, then a scheduled 2027–28 peak rate.
        const v1 = structuredClone(sp.content);
        v1.seasons[1].pricePerPerson = 23900;
        v1.photos = v1.photos.slice(0, 2);
        await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "release", versionNo: 1, content: v1, publishAt: ago(75 * DAY), note: "Imported from the old website", authorId: U.editor, createdAt: ago(75 * DAY) });
        const [v2] = await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "release", versionNo: 2, content: sp.content, publishAt: ago(21 * DAY), note: "Monsoon rate revised to ₹24,900; two more photos", authorId: U.editor, createdAt: ago(21 * DAY) }).returning();
        PKG[sp.code].releaseId = v2.id;
        const v3 = structuredClone(sp.content);
        v3.seasons[0].pricePerPerson = 34500;
        v3.seasons[0].name = "Peak 2027–28";
        await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "release", versionNo: 3, content: v3, publishAt: new Date(now + 120 * DAY), note: "Scheduled: next season's peak rate", authorId: U.admin, createdAt: ago(2 * DAY) });
        draft = v3;
      } else {
        const [v1] = await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "release", versionNo: 1, content: sp.content, publishAt: ago(60 * DAY), note: "Imported from the old website", authorId: U.editor, createdAt: ago(60 * DAY) }).returning();
        PKG[sp.code].releaseId = v1.id;
      }
      if (sp.code === "PKG-KL-03") {
        draft = structuredClone(sp.content);
        draft.summary = "A short, easy break: old Kochi's spice lanes, a Kathakali evening and a slow night on the backwaters.";
      }
    }
    await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "draft", versionNo: 0, content: draft, note: "", authorId: U.editor, createdAt: ago(1 * DAY) });
  }

  // ---- Enquiries -----------------------------------------------------------
  const live = SEED_PACKAGES.filter((p) => p.status === "published").map((p) => ({ id: PKG[p.code].id, code: p.code, slug: p.slug, content: p.content }));
  type Seed = {
    minutesAgo: number; channel: s.Channel; name: string; email?: string; phone?: string; message: string; pkg?: string;
    status: s.EnquiryStatus; assign?: string | null; replyAfter?: number; quote?: { pkg: string; date: string; adults: number; children: number };
    traveller?: boolean; whatsapp?: boolean; note?: string;
  };
  const SEEDS: Seed[] = [
    { minutesAgo: 25, channel: "web", name: "Priya Menon", email: "priya.menon@example.com", phone: "+91 98950 00012", message: "Hi, 2 adults and 1 kid, Kerala 5-6 nights in December, budget around 1.2 lakh total, houseboat a must", status: "new", assign: "anjali", whatsapp: true },
    { minutesAgo: 70, channel: "whatsapp", name: "Arjun Rao", phone: "+91 99000 00013", message: "Hello! We are newly married, planning our honeymoon in Munnar and Kumarakom 12-18 Jan. Looking for 5 star resorts with a pool. Budget up to 1.5 lakh total.", status: "new", assign: "rahul", whatsapp: true },
    { minutesAgo: 95, channel: "phone", name: "Lakshmi Iyer", phone: "+91 94470 00014", message: "Caller wants Madurai and Rameswaram for elderly parents, 2 adults, around 20th Dec, 4 nights. Needs wheelchair-friendly hotels. Prefers a call back after 6 pm.", status: "new", assign: null, note: "Logged from a phone call by Meera" },
    { minutesAgo: 140, channel: "chat", name: "Website chat visitor", email: "kiran.b@example.com", message: "kovalam beach 3N for 2 next month, cheap hotels ok. kiran.b@example.com", status: "new", assign: "fatima" },
    { minutesAgo: 230, channel: "chat", name: "Website chat visitor", message: "केरल में हनीमून पैकेज चाहिए दिसंबर में, बजट 80000", status: "new", assign: "rahul" },
    { minutesAgo: 1 * 1440 + 30, channel: "email", name: "Katrin Hoffmann", email: "k.hoffmann@example.com", message: "Dear team, we are a group of 18 from Munich travelling in February 2027 for about 10 days. We are interested in Kerala and Tamil Nadu, culture, temples and ayurveda. Budget approx EUR 1500 per person. Please send a proposal. Regards, Katrin", status: "replied", assign: "anjali", replyAfter: 48 },
    { minutesAgo: 1 * 1440 + 200, channel: "web", name: "Sandeep Kulkarni", email: "sandeep.k@example.com", phone: "+91 98450 00015", pkg: "PKG-KA-04", message: "Family of 5 (3 adults, 2 children aged 4 and 10). Coorg for a long weekend in December. Is the Coorg package available?", status: "replied", assign: "fatima", replyAfter: 35 },
    { minutesAgo: 2 * 1440 + 90, channel: "phone", name: "Deepa Krishnan", phone: "+91 94000 00016", message: "Asked about Ooty and Kodaikanal in May for 4 adults (parents and us), 5 nights, 4 star hotels.", status: "quoted", assign: "rahul", replyAfter: 22, quote: { pkg: "PKG-TN-06", date: "2027-05-08", adults: 4, children: 0 } },
    { minutesAgo: 2 * 1440 + 400, channel: "whatsapp", name: "Mohammed Faiz", phone: "+91 97440 00017", message: "Hi pls share price for houseboat 1 night, 2 adults 1 baby, 15 dec", status: "replied", assign: "anjali", replyAfter: 95, whatsapp: true },
    { minutesAgo: 3 * 1440 + 60, channel: "web", name: "Priya Sharma", email: "traveller@example.com", phone: "+91 98470 00011", pkg: "PKG-TN-09", message: "2 adults, Pondicherry and Mahabalipuram, 3 nights around Christmas. Heritage hotel please.", status: "quoted", assign: "fatima", replyAfter: 41, traveller: true, quote: { pkg: "PKG-TN-09", date: "2026-12-23", adults: 2, children: 0 } },
    { minutesAgo: 4 * 1440 + 120, channel: "web", name: "Rohan D'Souza", email: "rohan.dsouza@example.com", message: "Planning a Kerala trip in Onam with friends, 6 of us, 5 days, adventure and trekking please", status: "booked", assign: "rahul", replyAfter: 30 },
    { minutesAgo: 5 * 1440 + 15, channel: "email", name: "Oliver Bennett", email: "o.bennett@example.com", message: "We are a couple from the UK, 2 weeks in South India in March, want beaches, backwaters and heritage. Budget £4,000 total.", status: "booked", assign: "anjali", replyAfter: 55 },
    { minutesAgo: 6 * 1440 + 300, channel: "web", name: "Nisha Agarwal", email: "nisha.a@example.com", pkg: "PKG-KL-18", message: "Can you send me the itinerary for the grand kerala tour for 2 adults 1 child in april", status: "lost", assign: "fatima", replyAfter: 140 },
    { minutesAgo: 7 * 1440 + 100, channel: "web", name: "SEO Experts", email: "promo@example.com", message: "Best SEO services for your website, cheap price, contact now for first page ranking", status: "spam", assign: null },
    { minutesAgo: 8 * 1440 + 50, channel: "web", name: "Ananya Ghosh", email: "ananya.g@example.com", pkg: "PKG-KL-07", message: "Is the Munnar Thekkady Alleppey package available from 2027-01-10 for 2 adults? Houseboat must.", status: "replied", assign: "rahul", replyAfter: 28 },
  ];

  let enqNo = 10000;
  let quoteNo = 0;
  const lastAssigned: Record<string, Date> = {};
  const names: Record<string, string> = { anjali: "Anjali Pillai", rahul: "Rahul Menon", fatima: "Fatima Rasheed" };

  // Older enquiries land inside working hours (Mon–Sat, 10:00–16:30 IST) so reply times are realistic
  // whatever time of day the seed runs; today's enquiries stay relative to "now" so the timers are live.
  const atWorkingTime = (minutesAgo: number, i: number) => {
    const d = ago(minutesAgo * MIN);
    if (minutesAgo < 1440) return d;
    const ist = new Date(d.getTime() + 330 * MIN);
    if (ist.getUTCDay() === 0) ist.setUTCDate(ist.getUTCDate() - 1);
    ist.setUTCHours(10 + (i % 6), (i * 17) % 60, 0, 0);
    return new Date(ist.getTime() - 330 * MIN);
  };

  for (const [i, e] of [...SEEDS].reverse().entries()) {
    enqNo++;
    const createdAt = atWorkingTime(e.minutesAgo, i);
    const ref = `ENQ-${enqNo}`;
    const extraction = extractRules(e.message, createdAt);
    const assignedToId = e.assign ? U[e.assign] : null;
    if (e.assign) lastAssigned[e.assign] = createdAt;
    const firstReplyAt = e.replyAfter ? new Date(createdAt.getTime() + e.replyAfter * MIN) : null;
    const [enq] = await db.insert(s.enquiries).values({
      ref, channel: e.channel, packageId: e.pkg ? PKG[e.pkg].id : null, travellerId: e.traveller ? U.traveller : null,
      name: e.name, email: e.email ?? null, phone: e.phone ?? null, message: e.message,
      consentContact: true, consentWhatsapp: !!e.whatsapp, status: e.status, assignedToId, extraction,
      firstReplyAt, dueAt: dueAt(createdAt), createdAt, updatedAt: firstReplyAt ?? createdAt,
    }).returning();

    const ev = (type: (typeof s.enquiryEvents.$inferInsert)["type"], body: string, at: Date, actorId: string | null = null) =>
      db.insert(s.enquiryEvents).values({ enquiryId: enq.id, type, body, actorId, createdAt: at });

    await ev("received", `Received by ${e.channel}`, createdAt, e.channel === "phone" ? U.admin : null);
    if (e.note) await ev("note", e.note, createdAt, U.admin);
    if (e.email || (e.phone && e.whatsapp)) {
      const ackChannel = e.email ? "email" : "whatsapp";
      const vars = { name: e.name.split(" ")[0], ref };
      await db.insert(s.messages).values({ enquiryId: enq.id, channel: ackChannel, to: (e.email ?? e.phone)!, subject: fillTemplate(ACK_TEMPLATE.subject, vars), body: fillTemplate(ACK_TEMPLATE.body, vars), kind: "ack", createdAt: new Date(createdAt.getTime() + 2000) });
      await ev("ack", `Automatic acknowledgement sent by ${ackChannel}`, new Date(createdAt.getTime() + 2000));
    }
    await ev("ai", `Details extracted (${extraction.engine})`, new Date(createdAt.getTime() + 3000));
    if (assignedToId) await ev("assign", `Assigned to ${names[e.assign!]}`, new Date(createdAt.getTime() + 4000));

    if (firstReplyAt && assignedToId) {
      const suggestions = suggestPackages(extraction.fields, live);
      const d = draftReply({ name: e.name, fields: extraction.fields, suggestions, questions: extraction.questions, consultantName: names[e.assign!], siteUrl: "https://kayal.example.com" });
      const to = e.email ?? e.phone!;
      await db.insert(s.messages).values({ enquiryId: enq.id, channel: e.email ? "email" : "whatsapp", to, subject: d.subject, body: d.body, kind: "reply", sentById: assignedToId, createdAt: firstReplyAt });
      await ev("reply", `Reply sent to ${to}`, firstReplyAt, assignedToId);
    }
    if (e.quote) {
      const pk = PKG[e.quote.pkg];
      const price = priceParty(pk.content, e.quote.date, { adults: e.quote.adults, children: e.quote.children })!;
      quoteNo++;
      const at = new Date(createdAt.getTime() + (e.replyAfter ?? 30) * MIN + 20 * MIN);
      const qref = `Q-${new Date(at).getFullYear()}-${String(quoteNo).padStart(4, "0")}`;
      await db.insert(s.quotes).values({ ref: qref, token: crypto.randomUUID().replace(/-/g, ""), enquiryId: enq.id, packageId: pk.id, versionId: pk.releaseId!, travelDate: e.quote.date, adults: e.quote.adults, children: e.quote.children, price, note: "Includes airport pick-up. Rates held for 14 days.", validUntil: new Date(at.getTime() + 14 * DAY).toISOString().slice(0, 10), createdById: assignedToId, createdAt: at });
      await ev("quote", `Quote ${qref} created`, at, assignedToId);
    }
    if (["booked", "lost", "spam"].includes(e.status)) await ev("status", `Status changed to ${e.status}`, new Date(createdAt.getTime() + 2 * DAY), assignedToId ?? U.admin);
  }
  for (const [k, at] of Object.entries(lastAssigned)) await db.update(s.users).set({ lastAssignedAt: at }).where(sql`${s.users.id} = ${U[k]}`);
  await db.insert(s.counters).values([{ name: "enquiry", value: enqNo }, { name: "quote", value: quoteNo }]);

  // ---- Journal ----------------------------------------------------------------
  for (const p of SEED_POSTS) {
    const at = ago(p.daysAgo * DAY);
    await db.insert(s.blogPosts).values({ slug: p.slug, draft: p.content, published: p.content, publishAt: at, authorId: U[p.author], createdAt: at, updatedAt: at });
  }

  // ---- Old-site redirects (sample of the 140; the real list comes from a crawl) ----
  await db.insert(s.redirects).values(LEGACY.map((r, i) => ({ fromPath: normalizePath(r.from)!, toPath: r.to, hits: [41, 17, 9, 63, 5, 22, 3, 88, 12, 0, 7, 2, 0, 4, 1, 0, 6, 0][i] ?? 0, createdById: U.editor, createdAt: ago(40 * DAY) })));

  // ---- Activity log ----------------------------------------------------------
  await db.insert(s.auditLog).values([
    { actorId: U.editor, action: "package.publish", entityType: "package", entityId: PKG["PKG-KL-07"].id, summary: "Published PKG-KL-07 v2: Monsoon rate revised to ₹24,900", createdAt: ago(21 * DAY) },
    { actorId: U.admin, action: "package.schedule", entityType: "package", entityId: PKG["PKG-KL-07"].id, summary: "Scheduled PKG-KL-07 v3 (next season's peak rate)", createdAt: ago(2 * DAY) },
    { actorId: U.editor, action: "package.draft", entityType: "package", entityId: PKG["PKG-KL-03"].id, summary: "Edited draft of PKG-KL-03", createdAt: ago(1 * DAY) },
    { actorId: U.editor, action: "package.draft", entityType: "package", entityId: PKG["PKG-SI-12"].id, summary: "Edited draft of PKG-SI-12", createdAt: ago(1 * DAY) },
  ]);

  console.log(`Seeded ${people.length} users, ${SEED_PACKAGES.length} packages, ${SEED_POSTS.length} posts, ${SEEDS.length} enquiries.`);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

main()
  .then(() => client.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
