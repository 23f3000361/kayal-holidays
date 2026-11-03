import { describe, expect, it } from "vitest";
import { SEED_PACKAGES } from "@/data/packages";
import { SEED_POSTS } from "@/data/posts";
import { categorySlug, emptyPost, isLive, postProblems, postStatus, suggestRelated } from "./blog";
import { packageSlugsIn } from "./markdown";

const live = SEED_PACKAGES.filter((p) => p.status === "published").map((p) => ({ id: p.code, code: p.code, slug: p.slug, content: p.content }));
const now = new Date("2026-11-03T10:00:00Z");

describe("post status", () => {
  const c = emptyPost("Hello");
  it("is a draft until published", () => {
    expect(postStatus({ draft: c, published: null, publishAt: null }, now)).toBe("Draft");
    expect(isLive({ published: null, publishAt: null }, now)).toBe(false);
  });
  it("is scheduled until its time", () => {
    const later = new Date("2026-12-01T00:00:00Z");
    expect(postStatus({ draft: c, published: c, publishAt: later }, now)).toBe("Scheduled");
    expect(isLive({ published: c, publishAt: later }, now)).toBe(false);
    expect(isLive({ published: c, publishAt: later }, later)).toBe(true);
  });
  it("notices unpublished edits", () => {
    expect(postStatus({ draft: { ...c, title: "Edited" }, published: c, publishAt: now }, now)).toBe("Changes not published");
  });
});

describe("postProblems", () => {
  it("asks for a cover, words, excerpt and a related package", () => {
    expect(postProblems(emptyPost("x"))).toHaveLength(4);
  });
  it("passes every seeded post", () => {
    for (const p of SEED_POSTS) expect(postProblems(p.content), p.slug).toEqual([]);
  });
});

describe("suggestRelated", () => {
  it("suggests houseboat trips for a houseboat article", () => {
    const s = suggestRelated({ title: "Your first houseboat night in Alleppey", body: "Gliding through the backwaters of Alleppey on a kettuvallam..." }, live);
    expect(s[0].slug).toBe("munnar-thekkady-alleppey-houseboat");
    expect(s.every((x) => live.find((l) => l.slug === x.slug)!.content.themes.includes("houseboat") || x.parts[0].points > 0)).toBe(true);
  });
  it("suggests nothing for an off-topic post", () => {
    expect(suggestRelated({ title: "Office news", body: "We moved desks this week." }, live)).toEqual([]);
  });
});

describe("seed posts", () => {
  const slugs = new Set(live.map((p) => p.slug));
  it("link only to live packages", () => {
    for (const p of SEED_POSTS) {
      for (const s of [...p.content.relatedPackages, ...packageSlugsIn(p.content.body)]) expect(slugs.has(s), `${p.slug} -> ${s}`).toBe(true);
    }
  });
  it("have clean category slugs", () => {
    expect(categorySlug("Seasons & weather")).toBe("seasons-weather");
  });
});
