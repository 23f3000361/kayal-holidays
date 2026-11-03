import "server-only";
import { desc, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { validateRedirects, type RedirectRow } from "@/lib/redirects";
import { categorySlug } from "@/lib/blog";
import { REGION_INFO } from "@/lib/regions";
import { getLivePackages } from "./packages";
import { getLivePosts } from "./blog";
import { audit } from "./audit";
import { ActionError, type CurrentUser } from "./auth";

const STATIC_PAGES = ["/", "/packages", "/enquire", "/privacy", "/credits", "/blog", "/login", "/register", "/account"];

/** Every path a visitor can land on today, used to reject dead targets and hijacks. */
export async function knownPaths(): Promise<Set<string>> {
  const [packages, posts] = await Promise.all([getLivePackages(), getLivePosts()]);
  return new Set([
    ...STATIC_PAGES,
    ...Object.values(REGION_INFO).map((r) => `/destinations/${r.slug}`),
    ...packages.map((p) => `/packages/${p.slug}`),
    ...posts.map((p) => `/blog/${p.slug}`),
    ...posts.map((p) => `/blog/category/${categorySlug(p.content.category)}`),
  ]);
}

export async function listRedirects() {
  const [rows, known] = await Promise.all([db.select().from(s.redirects).orderBy(desc(s.redirects.hits), s.redirects.fromPath), knownPaths()]);
  // A target can stop existing later (package unpublished, post renamed): flag it.
  return rows.map((r) => ({ ...r, broken: !known.has(r.toPath.split("?")[0]) }));
}

export async function checkImport(rows: (RedirectRow & { line?: number })[]) {
  const [existing, known] = await Promise.all([db.select({ from: s.redirects.fromPath, to: s.redirects.toPath }).from(s.redirects), knownPaths()]);
  return validateRedirects(existing, rows, (p) => known.has(p));
}

export async function addRedirects(rows: (RedirectRow & { line?: number })[], user: CurrentUser) {
  const { ok, issues } = await checkImport(rows);
  if (ok.length) await db.insert(s.redirects).values(ok.map((r) => ({ fromPath: r.from, toPath: r.to, createdById: user.id })));
  if (ok.length) await audit(user.id, "redirect.add", "redirect", null, ok.length === 1 ? `Redirect ${ok[0].from} → ${ok[0].to}` : `Imported ${ok.length} redirects`);
  return { added: ok.length, issues };
}

export async function deleteRedirects(ids: string[], user: CurrentUser) {
  if (!ids.length) throw new ActionError("Nothing selected.");
  const rows = await db.select().from(s.redirects).where(inArray(s.redirects.id, ids));
  await db.delete(s.redirects).where(inArray(s.redirects.id, ids));
  await audit(user.id, "redirect.delete", "redirect", null, rows.length === 1 ? `Removed redirect ${rows[0].fromPath}` : `Removed ${rows.length} redirects`);
  return rows.length;
}

