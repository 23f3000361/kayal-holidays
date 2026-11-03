import "server-only";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, lte, max } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { packageContentSchema, publishProblems, emptyContent, type PackageContent } from "@/lib/package-content";
import { seasonCoverage, lowestPrice } from "@/lib/pricing";
import { resolveLive, supersededBy, upcoming } from "@/lib/versions";
import { regionSlug } from "@/lib/regions";
import { audit, lastActor } from "./audit";
import { fingerprint, type Conflict } from "@/lib/conflict";
import { ActionError, type CurrentUser } from "./auth";

export type LivePackage = { id: string; code: string; slug: string; versionNo: number; publishedAt: Date; content: PackageContent };

type Release = typeof s.packageVersions.$inferSelect;

function groupLive(pkgs: (typeof s.packages.$inferSelect)[], releases: Release[], now: Date): LivePackage[] {
  const byPkg = new Map<string, Release[]>();
  for (const r of releases) byPkg.set(r.packageId, [...(byPkg.get(r.packageId) ?? []), r]);
  const out: LivePackage[] = [];
  for (const p of pkgs) {
    const rs = (byPkg.get(p.id) ?? []).map((r) => ({ ...r, publishAt: r.publishAt! }));
    const live = resolveLive(rs, now);
    if (live) out.push({ id: p.id, code: p.code, slug: p.slug, versionNo: live.versionNo, publishedAt: live.publishAt, content: live.content });
  }
  return out;
}

/** Every package that is live right now (scheduled releases switch over by themselves). */
export async function getLivePackages(now = new Date()): Promise<LivePackage[]> {
  const pkgs = await db.select().from(s.packages).where(eq(s.packages.archived, false));
  const releases = await db.select().from(s.packageVersions).where(and(eq(s.packageVersions.kind, "release"), lte(s.packageVersions.publishAt, now)));
  return groupLive(pkgs, releases, now).sort((a, b) => a.content.title.localeCompare(b.content.title));
}

export async function getLiveBySlug(slug: string, now = new Date()): Promise<LivePackage | null> {
  const [pkg] = await db.select().from(s.packages).where(and(eq(s.packages.slug, slug), eq(s.packages.archived, false))).limit(1);
  if (!pkg) return null;
  const releases = await db.select().from(s.packageVersions).where(and(eq(s.packageVersions.packageId, pkg.id), eq(s.packageVersions.kind, "release"), lte(s.packageVersions.publishAt, now)));
  return groupLive([pkg], releases, now)[0] ?? null;
}

export type PackageStatus = { label: "Published" | "Draft" | "Unpublished" | "Changes not published"; scheduledAt: Date | null; liveVersion: number | null };

function statusOf(draft: PackageContent | undefined, releases: Release[], now: Date): PackageStatus {
  const rs = releases.map((r) => ({ ...r, publishAt: r.publishAt! }));
  const live = resolveLive(rs, now);
  const next = upcoming(rs, now)[0] ?? null;
  const everPublished = rs.some((r) => r.publishAt <= now);
  const latestDue = rs.filter((r) => r.publishAt <= now).sort((a, b) => b.publishAt.getTime() - a.publishAt.getTime())[0];
  const base = live ? "Published" : everPublished && latestDue?.visibility === "hidden" ? "Unpublished" : "Draft";
  const dirty = live && draft && JSON.stringify(draft) !== JSON.stringify((next ?? live).content);
  return { label: dirty ? "Changes not published" : base, scheduledAt: next?.publishAt ?? null, liveVersion: live?.versionNo ?? null };
}

export async function adminListPackages(now = new Date()) {
  const pkgs = await db.select().from(s.packages).where(eq(s.packages.archived, false)).orderBy(desc(s.packages.updatedAt));
  const versions = await db.select().from(s.packageVersions);
  return pkgs.map((p) => {
    const draft = versions.find((v) => v.packageId === p.id && v.kind === "draft");
    const releases = versions.filter((v) => v.packageId === p.id && v.kind === "release");
    const content = draft?.content ?? emptyContent();
    return { id: p.id, code: p.code, slug: p.slug, updatedAt: p.updatedAt, title: content.title, cover: content.photos[0]?.src ?? null, region: content.region, days: content.durationDays, fromPrice: lowestPrice(content), status: statusOf(draft?.content, releases, now) };
  });
}

export async function getPackageForEditor(id: string, now = new Date()) {
  const [pkg] = await db.select().from(s.packages).where(eq(s.packages.id, id)).limit(1);
  if (!pkg) return null;
  const versions = await db
    .select({ v: s.packageVersions, author: s.users.name })
    .from(s.packageVersions)
    .leftJoin(s.users, eq(s.users.id, s.packageVersions.authorId))
    .where(eq(s.packageVersions.packageId, id))
    .orderBy(desc(s.packageVersions.versionNo));
  const draftRow = versions.find((x) => x.v.kind === "draft");
  const releases = versions.filter((x) => x.v.kind === "release");
  const draft = draftRow?.v.content ?? emptyContent();
  const rs = releases.map((r) => ({ ...r.v, publishAt: r.v.publishAt! }));
  const live = resolveLive(rs, now);
  return {
    pkg,
    draft,
    draftSavedAt: draftRow?.v.createdAt ?? pkg.createdAt,
    releases: releases.map((r) => ({ ...r.v, author: r.author, isLive: r.v.id === live?.id, isScheduled: r.v.publishAt! > now })),
    live: live ? { id: live.id, versionNo: live.versionNo, content: live.content, publishAt: live.publishAt } : null,
    status: statusOf(draft, releases.map((r) => r.v), now),
    problems: publishProblems(draft, seasonCoverage),
  };
}

export function revalidatePublic(slug: string, region?: string) {
  revalidatePath(`/packages/${slug}`);
  revalidatePath("/packages");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  if (region) revalidatePath(`/destinations/${regionSlug(region)}`);
  revalidatePath("/blog", "layout"); // posts embed package cards and prices
}

export async function saveDraft(id: string, input: unknown, user: CurrentUser, baseHash?: string): Promise<{ ok: true; hash: string } | { ok: false; errors?: { path: string; message: string }[]; conflict?: Conflict }> {
  const parsed = packageContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  const [pkg] = await db.select().from(s.packages).where(eq(s.packages.id, id)).limit(1);
  if (!pkg) throw new ActionError("Package not found");
  const [current] = await db.select({ content: s.packageVersions.content }).from(s.packageVersions).where(and(eq(s.packageVersions.packageId, id), eq(s.packageVersions.kind, "draft"))).limit(1);
  // Someone else saved since this editor loaded the draft: refuse rather than overwrite.
  if (baseHash && current && fingerprint(current.content) !== baseHash) return { ok: false, conflict: await lastActor(id, ["package.draft", "package.restore"]) };
  await db.update(s.packageVersions).set({ content: parsed.data, authorId: user.id, createdAt: new Date() }).where(and(eq(s.packageVersions.packageId, id), eq(s.packageVersions.kind, "draft")));
  await db.update(s.packages).set({ updatedAt: new Date() }).where(eq(s.packages.id, id));
  await audit(user.id, "package.draft", "package", id, `Saved draft of ${pkg.code}`);
  return { ok: true, hash: fingerprint(parsed.data) };
}

export async function publishDraft(id: string, opts: { publishAt?: Date; note: string }, user: CurrentUser) {
  const ed = await getPackageForEditor(id);
  if (!ed) throw new ActionError("Package not found");
  const parsed = packageContentSchema.safeParse(ed.draft);
  if (!parsed.success) throw new ActionError("The draft has invalid fields. Save it again to see what to fix.");
  const errors = ed.problems.filter((p) => p.level === "error");
  if (errors.length) throw new ActionError(`Fix these before publishing: ${errors.map((e) => e.message).join(" ")}`);
  const now = new Date();
  const when = opts.publishAt && opts.publishAt > now ? opts.publishAt : now;
  const [{ n }] = await db.select({ n: max(s.packageVersions.versionNo) }).from(s.packageVersions).where(eq(s.packageVersions.packageId, id));
  const versionNo = (n ?? 0) + 1;
  // Older releases scheduled at or after this one could never go live; cancel them openly.
  const superseded = supersededBy(ed.releases.map((r) => ({ ...r, publishAt: r.publishAt! })), when, now);
  for (const r of superseded) {
    await db.delete(s.packageVersions).where(eq(s.packageVersions.id, r.id));
    await audit(user.id, "package.cancel", "package", id, `Cancelled scheduled ${ed.pkg.code} v${r.versionNo} (replaced by v${versionNo})`);
  }
  await db.insert(s.packageVersions).values({ packageId: id, kind: "release", versionNo, content: parsed.data, publishAt: when, note: opts.note.trim().slice(0, 200), authorId: user.id });
  await db.update(s.packages).set({ updatedAt: new Date() }).where(eq(s.packages.id, id));
  const scheduled = when.getTime() > Date.now() + 1000;
  await audit(user.id, scheduled ? "package.schedule" : "package.publish", "package", id, `${scheduled ? "Scheduled" : "Published"} ${ed.pkg.code} v${versionNo}${opts.note ? `: ${opts.note}` : ""}`);
  revalidatePublic(ed.pkg.slug, parsed.data.region);
  return { versionNo, scheduled, when, cancelled: superseded.map((r) => r.versionNo) };
}

export async function unpublish(id: string, user: CurrentUser) {
  const ed = await getPackageForEditor(id);
  if (!ed?.live) throw new ActionError("This package is not live.");
  const [{ n }] = await db.select({ n: max(s.packageVersions.versionNo) }).from(s.packageVersions).where(eq(s.packageVersions.packageId, id));
  await db.insert(s.packageVersions).values({ packageId: id, kind: "release", versionNo: (n ?? 0) + 1, content: ed.live.content, visibility: "hidden", publishAt: new Date(), note: "Taken off the website", authorId: user.id });
  await audit(user.id, "package.unpublish", "package", id, `Took ${ed.pkg.code} off the website`);
  revalidatePublic(ed.pkg.slug, ed.live.content.region);
}

export async function cancelScheduled(versionId: string, user: CurrentUser) {
  const [v] = await db.select().from(s.packageVersions).where(eq(s.packageVersions.id, versionId)).limit(1);
  if (!v || v.kind !== "release" || !v.publishAt || v.publishAt <= new Date()) throw new ActionError("Only releases that have not gone live can be cancelled.");
  await db.delete(s.packageVersions).where(eq(s.packageVersions.id, versionId));
  await audit(user.id, "package.cancel", "package", v.packageId, `Cancelled scheduled v${v.versionNo}`);
}

export async function restoreToDraft(versionId: string, user: CurrentUser) {
  const [v] = await db.select().from(s.packageVersions).where(eq(s.packageVersions.id, versionId)).limit(1);
  if (!v || v.kind !== "release") throw new ActionError("Version not found");
  await db.update(s.packageVersions).set({ content: v.content, authorId: user.id, createdAt: new Date() }).where(and(eq(s.packageVersions.packageId, v.packageId), eq(s.packageVersions.kind, "draft")));
  await audit(user.id, "package.restore", "package", v.packageId, `Copied v${v.versionNo} into the draft`);
  return v.packageId;
}

export function slugify(t: string) {
  return t.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

async function uniqueSlug(base: string) {
  let slug = base || "package";
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: s.packages.id }).from(s.packages).where(eq(s.packages.slug, slug)).limit(1);
    if (!hit) return slug;
    slug = `${base}-${i}`;
  }
}

export async function createPackage(input: { code: string; title: string; region: PackageContent["region"] }, user: CurrentUser) {
  const code = input.code.trim().toUpperCase();
  const [dup] = await db.select({ id: s.packages.id }).from(s.packages).where(eq(s.packages.code, code)).limit(1);
  if (dup) throw new ActionError(`${code} already exists.`);
  const slug = await uniqueSlug(slugify(input.title));
  const [pkg] = await db.insert(s.packages).values({ code, slug }).returning();
  await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "draft", versionNo: 0, content: { ...emptyContent(), title: input.title.trim(), region: input.region }, authorId: user.id });
  await audit(user.id, "package.create", "package", pkg.id, `Created ${code}`);
  return pkg.id;
}

export async function duplicatePackage(id: string, user: CurrentUser) {
  const ed = await getPackageForEditor(id);
  if (!ed) throw new ActionError("Package not found");
  let code = `${ed.pkg.code}-B`;
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: s.packages.id }).from(s.packages).where(eq(s.packages.code, code)).limit(1);
    if (!hit) break;
    code = `${ed.pkg.code}-B${i}`;
  }
  const content: PackageContent = { ...structuredClone(ed.draft), title: `Copy of ${ed.draft.title}` };
  const slug = await uniqueSlug(slugify(content.title));
  const [pkg] = await db.insert(s.packages).values({ code, slug }).returning();
  await db.insert(s.packageVersions).values({ packageId: pkg.id, kind: "draft", versionNo: 0, content, authorId: user.id });
  await audit(user.id, "package.duplicate", "package", pkg.id, `Duplicated ${ed.pkg.code} as ${code}`);
  return pkg.id;
}

/** Slug can change only before first publish, so live URLs never break. */
export async function updateIdentity(id: string, input: { code: string; slug: string }, user: CurrentUser) {
  const ed = await getPackageForEditor(id);
  if (!ed) throw new ActionError("Package not found");
  const code = input.code.trim().toUpperCase();
  const slug = slugify(input.slug);
  if (slug !== ed.pkg.slug && ed.releases.length > 0) throw new ActionError("The web address can't change after the package has been published.");
  const clash = await db.select({ id: s.packages.id, code: s.packages.code, slug: s.packages.slug }).from(s.packages).where(inArray(s.packages.slug, [slug]));
  if (clash.some((c) => c.id !== id)) throw new ActionError("Another package already uses that web address.");
  const codeClash = await db.select({ id: s.packages.id }).from(s.packages).where(eq(s.packages.code, code));
  if (codeClash.some((c) => c.id !== id)) throw new ActionError(`${code} already exists.`);
  await db.update(s.packages).set({ code, slug, updatedAt: new Date() }).where(eq(s.packages.id, id));
  await audit(user.id, "package.identity", "package", id, `Changed code/address to ${code} /packages/${slug}`);
}
