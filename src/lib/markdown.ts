/**
 * A small Markdown subset for blog posts, parsed into a tree that React renders.
 * Raw HTML is never interpreted, so a post can't inject scripts or styles:
 * everything that isn't recognised stays plain text.
 *
 * Blocks: ## / ### headings, paragraphs, - and 1. lists, > quotes, ---,
 *         ![alt](/photos/x.jpg) images, [[package:slug]] package cards.
 * Inline: **bold**, *italic*, [text](https://… or /path).
 */

export type Inline = { t: "text"; v: string } | { t: "b"; c: Inline[] } | { t: "i"; c: Inline[] } | { t: "a"; href: string; c: Inline[] };
export type Block =
  | { type: "h2" | "h3" | "p" | "quote"; c: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "img"; src: string; alt: string }
  | { type: "package"; slug: string }
  | { type: "hr" };

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\/[^\s]+$/i.test(h)) return h;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(h)) return h;
  if (/^\/(?!\/)[\w\-./?=&#%]*$/.test(h)) return h; // same-site path, not protocol-relative
  return null;
}

export const safeImage = (src: string) => /^\/(photos|media)\/[\w\-.]+$/.test(src.trim());

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let text = "";
  const flush = () => {
    if (text) out.push({ t: "text", v: text });
    text = "";
  };
  while (i < s.length) {
    const rest = s.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\*\*(.+?)\*\*/))) {
      flush();
      out.push({ t: "b", c: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*(?!\s)(.+?)\*/))) {
      flush();
      out.push({ t: "i", c: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      const href = safeHref(m[2]);
      flush();
      if (href) out.push({ t: "a", href, c: parseInline(m[1]) });
      else out.push({ t: "text", v: m[1] }); // unsafe link: keep the words, drop the link
      i += m[0].length;
    } else {
      text += s[i];
      i++;
    }
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const endPara = () => {
    if (para.length) blocks.push({ type: "p", c: parseInline(para.join(" ").trim()) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const t = line.trim();
    let m: RegExpMatchArray | null;
    if (!t) {
      endPara();
    } else if ((m = t.match(/^(#{2,3})\s+(.+)$/))) {
      endPara();
      blocks.push({ type: m[1].length === 2 ? "h2" : "h3", c: parseInline(m[2]) });
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      endPara();
      blocks.push({ type: "hr" });
    } else if ((m = t.match(/^\[\[package:([a-z0-9-]{1,80})\]\]$/))) {
      endPara();
      blocks.push({ type: "package", slug: m[1] });
    } else if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
      endPara();
      if (safeImage(m[2])) blocks.push({ type: "img", src: m[2], alt: m[1] });
    } else if (t.startsWith(">")) {
      endPara();
      const q: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) q.push(lines[i++].trim().replace(/^>\s?/, ""));
      i--;
      blocks.push({ type: "quote", c: parseInline(q.join(" ")) });
    } else if (/^([-*]|\d+\.)\s+/.test(t)) {
      endPara();
      const ordered = /^\d+\./.test(t);
      const items: Inline[][] = [];
      const re = ordered ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;
      while (i < lines.length && re.test(lines[i].trim())) items.push(parseInline(lines[i++].trim().match(re)![1]));
      i--;
      blocks.push({ type: ordered ? "ol" : "ul", items });
    } else {
      para.push(t);
    }
  }
  endPara();
  return blocks;
}

/** Plain text of a post, for search, excerpts, reading time and package matching. */
export function plainText(src: string): string {
  const inl = (c: Inline[]): string => c.map((x) => (x.t === "text" ? x.v : inl(x.c))).join("");
  return parseMarkdown(src)
    .map((b) => ("c" in b ? inl(b.c) : "items" in b ? b.items.map(inl).join(". ") : ""))
    .filter(Boolean)
    .join("\n");
}

export function readingMinutes(src: string): number {
  return Math.max(1, Math.round(plainText(src).split(/\s+/).filter(Boolean).length / 200));
}

export function packageSlugsIn(src: string): string[] {
  return parseMarkdown(src).flatMap((b) => (b.type === "package" ? [b.slug] : []));
}
