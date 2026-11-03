import { z } from "zod";
import { extractRules } from "./ai/extract";
import { suggestPackages, type Candidate } from "./ai/suggest";
import { plainText } from "./markdown";

/**
 * A post keeps a working draft and, once published, a published copy. Saving never
 * changes the live page; publishing copies the draft across. A post that has never
 * been live can be scheduled for a future time.
 */

export const postContentSchema = z.object({
  title: z.string().trim().min(3, "Title is required").max(140),
  excerpt: z.string().trim().max(300).default(""),
  body: z.string().max(40_000).default(""),
  category: z.string().trim().min(2, "Pick or type a category").max(40),
  cover: z.object({ src: z.string().regex(/^\/(photos|media)\/[\w\-.]+$/, "Pick a cover photo from the library"), alt: z.string().trim().max(160).default("") }).nullable(),
  relatedPackages: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(4),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
});
export type PostContent = z.infer<typeof postContentSchema>;

export function emptyPost(title = ""): PostContent {
  return { title, excerpt: "", body: "", category: "Guides", cover: null, relatedPackages: [], seoTitle: "", seoDescription: "" };
}

export type PostStatus = "Draft" | "Scheduled" | "Published" | "Changes not published";

export function postStatus(p: { draft: PostContent; published: PostContent | null; publishAt: Date | null }, now: Date): PostStatus {
  if (!p.published || !p.publishAt) return "Draft";
  if (p.publishAt > now) return "Scheduled";
  return JSON.stringify(p.draft) === JSON.stringify(p.published) ? "Published" : "Changes not published";
}

export function isLive(p: { published: PostContent | null; publishAt: Date | null }, now: Date) {
  return !!p.published && !!p.publishAt && p.publishAt <= now;
}

export const categorySlug = (c: string) => c.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Problems that block publishing a post. */
export function postProblems(c: PostContent): string[] {
  const p: string[] = [];
  if (!c.cover) p.push("Add a cover photo.");
  if (plainText(c.body).split(/\s+/).filter(Boolean).length < 80) p.push("The post is very short; write at least 80 words.");
  if (!c.excerpt) p.push("Add a one-line excerpt for the blog list and search results.");
  if (c.relatedPackages.length === 0) p.push("Link at least one related package, so readers have somewhere to go next.");
  return p;
}

/**
 * Suggests packages for a post by reading its text with the same extraction engine the
 * inbox uses (places, themes, trip type) and ranking live packages. Editors still choose.
 */
export function suggestRelated(c: Pick<PostContent, "title" | "body">, candidates: Candidate[], limit = 3) {
  const text = `${c.title}\n${plainText(c.body)}`;
  const ex = extractRules(text);
  const f = { ...ex.fields, budget: null, nights: null, adults: null, children: null, travelDates: null };
  // Everything a post mentions is an interest, not a must-have.
  const themes = [...(f.mustHaves?.value ?? []), ...(f.interests?.value ?? [])];
  f.mustHaves = null;
  f.interests = themes.length ? { value: themes, confidence: 0.8, evidence: [] } : null;
  return suggestPackages(f, candidates, limit).filter((s) => s.score >= 45);
}
