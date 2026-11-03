import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, plainText, readingMinutes, packageSlugsIn, safeHref } from "./markdown";

describe("parseMarkdown", () => {
  it("parses headings, paragraphs, lists, quotes and rules", () => {
    const b = parseMarkdown("## Title\n\nOne line\nsame para\n\n- a\n- b\n\n1. x\n2. y\n\n> quoted\n> more\n\n---");
    expect(b.map((x) => x.type)).toEqual(["h2", "p", "ul", "ol", "quote", "hr"]);
    expect(b[1]).toEqual({ type: "p", c: [{ t: "text", v: "One line same para" }] });
    expect(b[2]).toMatchObject({ type: "ul", items: [[{ t: "text", v: "a" }], [{ t: "text", v: "b" }]] });
    expect(b[4]).toEqual({ type: "quote", c: [{ t: "text", v: "quoted more" }] });
  });

  it("parses inline bold, italic and links", () => {
    expect(parseInline("a **b** *c* [d](/packages/x)")).toEqual([
      { t: "text", v: "a " },
      { t: "b", c: [{ t: "text", v: "b" }] },
      { t: "text", v: " " },
      { t: "i", c: [{ t: "text", v: "c" }] },
      { t: "text", v: " " },
      { t: "a", href: "/packages/x", c: [{ t: "text", v: "d" }] },
    ]);
  });

  it("never lets HTML or script links through", () => {
    const b = parseMarkdown('<script>alert(1)</script>\n\n[click](javascript:alert(1)) [x](//evil.example)');
    expect(b[0]).toEqual({ type: "p", c: [{ t: "text", v: "<script>alert(1)</script>" }] });
    expect(JSON.stringify(b[1])).not.toContain("javascript");
    expect(JSON.stringify(b[1])).not.toContain("evil");
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
  });

  it("only allows images from the photo library", () => {
    expect(parseMarkdown("![ok](/photos/munnar-tea.jpg)")).toEqual([{ type: "img", src: "/photos/munnar-tea.jpg", alt: "ok" }]);
    expect(parseMarkdown("![bad](https://tracker.example/pixel.gif)")).toEqual([]);
  });

  it("finds package cards and plain text", () => {
    const src = "## Houseboats\n\nRead **this**.\n\n[[package:munnar-thekkady-alleppey-houseboat]]";
    expect(packageSlugsIn(src)).toEqual(["munnar-thekkady-alleppey-houseboat"]);
    expect(plainText(src)).toBe("Houseboats\nRead this.");
    expect(readingMinutes("word ".repeat(450))).toBe(2);
  });
});
