import { sqliteTable, text, integer, index, uniqueIndex, blob } from "drizzle-orm/sqlite-core";
import type { PackageContent } from "@/lib/package-content";
import type { Extraction } from "@/lib/ai/extract";
import type { PriceBreakdown } from "@/lib/pricing";
import type { PostContent } from "@/lib/blog";
import { ROLES, CHANNELS, STATUSES } from "@/lib/constants";
export { ROLES, CHANNELS, STATUSES } from "@/lib/constants";
export type { Role, Channel, EnquiryStatus } from "@/lib/constants";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date());


export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  lastAssignedAt: integer("last_assigned_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // sha-256 of the cookie token; the raw token is never stored
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const packages = sqliteTable("packages", {
  id: id(),
  code: text("code").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

/** kind=draft: the single editable working copy. kind=release: an immutable published snapshot. */
export const packageVersions = sqliteTable(
  "package_versions",
  {
    id: id(),
    packageId: text("package_id").notNull().references(() => packages.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["draft", "release"] }).notNull(),
    versionNo: integer("version_no").notNull(), // 0 for the draft
    content: text("content", { mode: "json" }).$type<PackageContent>().notNull(),
    visibility: text("visibility", { enum: ["public", "hidden"] }).notNull().default("public"),
    publishAt: integer("publish_at", { mode: "timestamp_ms" }),
    note: text("note").notNull().default(""),
    authorId: text("author_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("pv_package_idx").on(t.packageId, t.kind), uniqueIndex("pv_package_version_uq").on(t.packageId, t.kind, t.versionNo)],
);

export const media = sqliteTable("media", {
  id: id(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: blob("bytes", { mode: "buffer" }).notNull(),
  alt: text("alt").notNull().default(""),
  uploadedById: text("uploaded_by_id").references(() => users.id),
  createdAt: createdAt(),
});


export const enquiries = sqliteTable(
  "enquiries",
  {
    id: id(),
    ref: text("ref").notNull().unique(), // ENQ-10001
    channel: text("channel", { enum: CHANNELS }).notNull(),
    packageId: text("package_id").references(() => packages.id),
    travellerId: text("traveller_id").references(() => users.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    message: text("message").notNull(),
    // Structured fields the traveller typed in the form (optional); AI fills the rest.
    formDate: text("form_date"),
    formAdults: integer("form_adults"),
    formChildren: integer("form_children"),
    consentContact: integer("consent_contact", { mode: "boolean" }).notNull().default(false),
    consentWhatsapp: integer("consent_whatsapp", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: STATUSES }).notNull().default("new"),
    assignedToId: text("assigned_to_id").references(() => users.id),
    extraction: text("extraction", { mode: "json" }).$type<Extraction>(),
    // Values a consultant confirmed or corrected. Suggestions and drafts use these when present.
    confirmed: text("confirmed", { mode: "json" }).$type<Partial<Record<string, unknown>>>(),
    confirmedById: text("confirmed_by_id").references(() => users.id),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    firstReplyAt: integer("first_reply_at", { mode: "timestamp_ms" }),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("enq_status_idx").on(t.status), index("enq_assigned_idx").on(t.assignedToId), index("enq_created_idx").on(t.createdAt)],
);

export const enquiryEvents = sqliteTable(
  "enquiry_events",
  {
    id: id(),
    enquiryId: text("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["received", "ack", "ai", "note", "reply", "status", "assign", "quote", "correction"] }).notNull(),
    body: text("body").notNull().default(""),
    actorId: text("actor_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("ev_enquiry_idx").on(t.enquiryId)],
);

/** Outbound messages. Delivery is mocked: "sent" means it is in the outbox, nothing leaves the system. */
export const messages = sqliteTable("messages", {
  id: id(),
  enquiryId: text("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
  channel: text("channel", { enum: ["email", "whatsapp"] }).notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull().default(""),
  body: text("body").notNull(),
  kind: text("kind", { enum: ["ack", "reply"] }).notNull(),
  sentById: text("sent_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const quotes = sqliteTable("quotes", {
  id: id(),
  ref: text("ref").notNull().unique(), // Q-2026-0001
  token: text("token").notNull().unique(), // unguessable link token
  enquiryId: text("enquiry_id").notNull().references(() => enquiries.id, { onDelete: "cascade" }),
  packageId: text("package_id").notNull().references(() => packages.id),
  versionId: text("version_id").notNull().references(() => packageVersions.id),
  travelDate: text("travel_date").notNull(),
  adults: integer("adults").notNull(),
  children: integer("children").notNull(),
  price: text("price", { mode: "json" }).$type<PriceBreakdown>().notNull(),
  note: text("note").notNull().default(""),
  validUntil: text("valid_until").notNull(),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id),
    action: text("action").notNull(), // e.g. package.publish
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const counters = sqliteTable("counters", {
  name: text("name").primaryKey(),
  value: integer("value").notNull(),
});

/** Journal posts: an editable draft plus the published copy shown on the site. */
export const blogPosts = sqliteTable(
  "blog_posts",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    draft: text("draft", { mode: "json" }).$type<PostContent>().notNull(),
    published: text("published", { mode: "json" }).$type<PostContent>(),
    publishAt: integer("publish_at", { mode: "timestamp_ms" }),
    authorId: text("author_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("blog_publish_idx").on(t.publishAt)],
);

/** Old-site URLs that permanently redirect to new pages. Checked by the proxy on every request. */
export const redirects = sqliteTable("redirects", {
  id: id(),
  fromPath: text("from_path").notNull().unique(), // normalised: lower case, no trailing slash
  toPath: text("to_path").notNull(),
  hits: integer("hits").notNull().default(0),
  lastHitAt: integer("last_hit_at", { mode: "timestamp_ms" }),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});
