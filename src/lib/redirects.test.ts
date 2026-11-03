import { describe, expect, it } from "vitest";
import redirects from "@/data/legacy-redirects.json";
import { SEED_PACKAGES } from "@/data/packages";
import { REGION_INFO } from "./regions";
import { lookup, normalizePath, parseCsv, validateRedirects } from "./redirects";

const STATIC = new Set(["/", "/packages", "/enquire", "/privacy", "/blog", ...Object.values(REGION_INFO).map((r) => `/destinations/${r.slug}`)]);
const PACKAGE_PATHS = new Set(SEED_PACKAGES.filter((p) => p.status === "published").map((p) => `/packages/${p.slug}`));
const exists = (p: string) => STATIC.has(p) || PACKAGE_PATHS.has(p);

describe("normalizePath", () => {
  it("tidies case, trailing slashes and full URLs", () => {
    expect(normalizePath("/Kerala-Tours.HTML/")).toBe("/kerala-tours.html");
    expect(normalizePath("https://oldsite.example/tours/munnar.html#top")).toBe("/tours/munnar.html");
    expect(normalizePath("/package.php?id=7")).toBe("/package.php?id=7");
  });
  it("rejects things that aren't paths", () => {
    expect(normalizePath("kerala.html")).toBeNull();
    expect(normalizePath("//evil.example/x")).toBeNull();
    expect(normalizePath("/a b")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("reads rows, skips the header and comments, reports bad lines", () => {
    const { rows, issues } = parseCsv('from,to\n# old site\n"/a.html","/packages"\n/b.html;/enquire\nonly-one-column');
    expect(rows.map((r) => [r.line, r.from, r.to])).toEqual([[3, "/a.html", "/packages"], [4, "/b.html", "/enquire"]]);
    expect(issues).toEqual([{ line: 5, from: "only-one-column", to: "", error: "Needs two columns: old URL, new URL" }]);
  });
});

describe("validateRedirects", () => {
  const existing = [{ from: "/old.html", to: "/packages" }];
  const run = (rows: { from: string; to: string }[]) => validateRedirects(existing, rows, exists);

  it("accepts good rows, normalised", () => {
    expect(run([{ from: "/Tours/Munnar.html", to: "/packages/munnar-thekkady-alleppey-houseboat" }]).ok).toEqual([{ from: "/tours/munnar.html", to: "/packages/munnar-thekkady-alleppey-houseboat" }]);
  });
  it("rejects dead targets, chains, loops, duplicates and hijacks", () => {
    const { issues } = run([
      { from: "/x.html", to: "/packages/does-not-exist" },
      { from: "/y.html", to: "/old.html" },
      { from: "/z.html", to: "/z.html" },
      { from: "/old.html", to: "/enquire" },
      { from: "/packages", to: "/enquire" },
      { from: "/w.html", to: "/enquire" },
      { from: "/W.html", to: "/privacy" },
    ]);
    expect(issues.map((i) => i.error)).toEqual([
      "New URL doesn't exist on the site",
      "New URL doesn't exist on the site",
      "Points to itself",
      "Already redirects to /packages",
      "That old URL is a live page on the new site; a redirect would hide it",
      "Listed twice in this import",
    ]);
  });
  it("rejects a chain inside one import", () => {
    expect(run([{ from: "/a.html", to: "/b.html" }, { from: "/b.html", to: "/enquire" }]).issues[0].error).toBe("New URL doesn't exist on the site");
  });
});

describe("lookup", () => {
  const map = new Map([["/kerala-tours.html", "/destinations/kerala"], ["/package.php?id=7", "/packages/coorg-mysore"]]);
  it("matches regardless of case and trailing slash, and with query strings", () => {
    expect(lookup(map, "/Kerala-Tours.html/")).toBe("/destinations/kerala");
    expect(lookup(map, "/package.php", "?id=7")).toBe("/packages/coorg-mysore");
    expect(lookup(map, "/package.php", "?id=8")).toBeNull();
  });
});

describe("the shipped sample of old URLs", () => {
  it("passes the same checks the admin import uses", () => {
    expect(validateRedirects([], redirects, exists).issues).toEqual([]);
  });
});
