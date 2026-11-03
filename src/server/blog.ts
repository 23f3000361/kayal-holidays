import "server-only";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { categorySlug, emptyPost, isLive, postContentSchema, postProblems, postStatus, type PostContent } from "@/lib/blog";
import { audit } from "./audit";
import { ActionError, type CurrentUser } from "./auth";
import { getLivePackages, slugify } from "./packages";

export type LivePost = { id: string; slug: string; publishAt: Date; author: string | null; content: PostContent };

export async function getLivePosts(now = new Date()): Promise<LivePost[]> {
  const rows = await db
    .select({ p: s.blogPosts, author: s.users.name })
    .from(s.blogPosts)
    .leftJoin(s.users, eq(s.users.id, s.blogPosts.authorId))
    .where(and(isNotNull(s.blogPosts.published), lte(s.blogPosts.publishAt, now)))
    .orderBy(desc(s.blogPosts.publishAt));
  return rows.map(({ p, author }) => ({ id: p.id, slug: p.slug, publishAt: p.publishAt!, author, content: p.published! }));
}

export async function getLivePost(slug: string, now = new Date()) {
  return (await getLivePosts(now)).find((p) => p.slug === slug) ?? null;
}

/** Live packages a post links to, in the editor's order; missing or unpublished ones are skipped. */
export async function packagesForPost(c: PostContent) {
  const live = await getLivePackages();
  return c.relatedPackages.map((slug) => live.find((p) => p.slug === slug)).filter((p): p is NonNullable<typeof p> => !!p);
}

export async function adminListPosts(now = new Date()) {
  const rows = await db.select({ p: s.blogPosts, author: s.users.name }).from(s.blogPosts).leftJoin(s.users, eq(s.users.id, s.blogPosts.authorId)).orderBy(desc(s.blogPosts.updatedAt));
  return rows.map(({ p, author }) => ({ id: p.id, slug: p.slug, title: p.draft.title, category: p.draft.category, cover: p.draft.cover?.src ?? null, author, updatedAt: p.updatedAt, publishAt: p.publishAt, status: postStatus(p, now) }));
}

export async function getPostForEditor(id: string, now = new Date()) {
  const [p] = await db.select().from(s.blogPosts).where(eq(s.blogPosts.id, id)).limit(1);
  if (!p) return null;
  return { post: p, status: postStatus(p, now), live: isLive(p, now), problems: postProblems(p.draft) };
}

export async function categories(): Promise<string[]> {
  const rows = await db.select({ d: s.blogPosts.draft }).from(s.blogPosts);
  return [...new Set(["Guides", "Seasons", "Honeymoons", ...rows.map((r) => r.d.category)])].sort();
}

function revalidateBlog(slug: string, category?: string) {
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  if (category) revalidatePath(`/blog/category/${categorySlug(category)}`);
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
}

export async function createPost(title: string, user: CurrentUser) {
  const base = slugify(title) || "post";
  let slug = base;
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: s.blogPosts.id }).from(s.blogPosts).where(eq(s.blogPosts.slug, slug)).limit(1);
    if (!hit) break;
    slug = `${base}-${i}`;
  }
  const [p] = await db.insert(s.blogPosts).values({ slug, draft: emptyPost(title.trim()), authorId: user.id }).returning();
  await audit(user.id, "post.create", "post", p.id, `Created post "${title.trim()}"`);
  return p.id;
}

export async function savePostDraft(id: string, input: unknown, user: CurrentUser) {
  const parsed = postContentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  const ed = await getPostForEditor(id);
  if (!ed) throw new ActionError("Post not found");
  await db.update(s.blogPosts).set({ draft: parsed.data, updatedAt: new Date() }).where(eq(s.blogPosts.id, id));
  await audit(user.id, "post.draft", "post", id, `Saved draft of "${parsed.data.title}"`);
  return { ok: true as const };
}

export async function publishPost(id: string, publishAt: Date | undefined, user: CurrentUser) {
  const ed = await getPostForEditor(id);
  if (!ed) throw new ActionError("Post not found");
  const content = postContentSchema.parse(ed.post.draft);
  if (ed.problems.length) throw new ActionError(`Fix these before publishing: ${ed.problems.join(" ")}`);
  const live = await getLivePackages();
  const missing = content.relatedPackages.filter((slug) => !live.some((p) => p.slug === slug));
  if (missing.length) throw new ActionError(`These related packages are not live: ${missing.join(", ")}.`);
  const now = new Date();
  // A live post can't be "scheduled": that would take it off the site until then.
  if (publishAt && publishAt > now && ed.live) throw new ActionError("This post is already live. Updates to a live post are published straight away.");
  const when = publishAt && publishAt > now ? publishAt : ed.live ? ed.post.publishAt! : now;
  await db.update(s.blogPosts).set({ published: content, publishAt: when, updatedAt: now }).where(eq(s.blogPosts.id, id));
  const scheduled = when > now;
  await audit(user.id, scheduled ? "post.schedule" : "post.publish", "post", id, `${scheduled ? "Scheduled" : "Published"} "${content.title}"`);
  revalidateBlog(ed.post.slug, content.category);
  if (ed.post.published && ed.post.published.category !== content.category) revalidateBlog(ed.post.slug, ed.post.published.category);
  return { scheduled, when };
}

export async function unpublishPost(id: string, user: CurrentUser) {
  const ed = await getPostForEditor(id);
  if (!ed?.post.published) throw new ActionError("This post is not published.");
  await db.update(s.blogPosts).set({ published: null, publishAt: null, updatedAt: new Date() }).where(eq(s.blogPosts.id, id));
  await audit(user.id, "post.unpublish", "post", id, `Took "${ed.post.published.title}" off the site`);
  revalidateBlog(ed.post.slug, ed.post.published.category);
}

export async function updatePostSlug(id: string, slugInput: string, user: CurrentUser) {
  const ed = await getPostForEditor(id);
  if (!ed) throw new ActionError("Post not found");
  if (ed.post.published) throw new ActionError("The web address can't change after the post has been published.");
  const slug = slugify(slugInput);
  if (slug.length < 3) throw new ActionError("Use at least 3 letters or numbers.");
  const [hit] = await db.select({ id: s.blogPosts.id }).from(s.blogPosts).where(eq(s.blogPosts.slug, slug)).limit(1);
  if (hit && hit.id !== id) throw new ActionError("Another post already uses that address.");
  await db.update(s.blogPosts).set({ slug, updatedAt: new Date() }).where(eq(s.blogPosts.id, id));
  await audit(user.id, "post.slug", "post", id, `Changed address to /blog/${slug}`);
}
