/**
 * Old-site URL redirects. Pure helpers shared by the admin screen, the importer and the proxy.
 * Paths are compared case-insensitively and without a trailing slash, because the old
 * freelancer site linked to the same page in several spellings.
 */

export type RedirectRow = { from: string; to: string };
export type RowIssue = { line: number; from: string; to: string; error: string };

export function normalizePath(input: string): string | null {
  let p = input.trim();
  if (!p) return null;
  // Accept full URLs pasted from a crawl report; keep only the path and query.
  const m = p.match(/^https?:\/\/[^/]+(\/.*)?$/i);
  if (m) p = m[1] ?? "/";
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  p = p.split("#")[0];
  if (/\s/.test(p) || p.length > 300) return null;
  p = p.toLowerCase();
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  return p;
}

/** Simple CSV: "from,to" per line, optional header, quotes allowed, # comments ignored. */
export function parseCsv(text: string): { rows: (RedirectRow & { line: number })[]; issues: RowIssue[] } {
  const rows: (RedirectRow & { line: number })[] = [];
  const issues: RowIssue[] = [];
  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (!t || t.startsWith("#")) return;
    const cells = t.split(/[,;\t]/).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    if (line === 1 && /^(from|old|source)/i.test(cells[0])) return; // header
    if (cells.length < 2 || !cells[0] || !cells[1]) {
      issues.push({ line, from: cells[0] ?? "", to: cells[1] ?? "", error: "Needs two columns: old URL, new URL" });
      return;
    }
    rows.push({ line, from: cells[0], to: cells[1] });
  });
  return { rows, issues };
}

/**
 * Checks a full set of redirects (existing + proposed). `exists(path)` says whether a live page
 * answers at that path. Problems are reported per proposed row.
 */
export function validateRedirects(existing: RedirectRow[], proposed: (RedirectRow & { line?: number })[], exists: (path: string) => boolean): { ok: RedirectRow[]; issues: RowIssue[] } {
  const ok: RedirectRow[] = [];
  const issues: RowIssue[] = [];
  const sources = new Map(existing.map((r) => [r.from, r.to]));
  const seen = new Set<string>();

  for (const [i, r] of proposed.entries()) {
    const line = r.line ?? i + 1;
    const from = normalizePath(r.from);
    const to = normalizePath(r.to);
    const fail = (error: string) => issues.push({ line, from: r.from, to: r.to, error });
    if (!from) { fail("Old URL must be a path like /tours/kerala.html"); continue; }
    if (!to) { fail("New URL must be a path on this site, like /packages/…"); continue; }
    if (from === to) { fail("Points to itself"); continue; }
    if (seen.has(from)) { fail("Listed twice in this import"); continue; }
    if (sources.has(from)) { fail(`Already redirects to ${sources.get(from)}`); continue; }
    if (exists(from)) { fail("That old URL is a live page on the new site; a redirect would hide it"); continue; }
    if (!exists(to.split("?")[0])) { fail("New URL doesn't exist on the site"); continue; }
    if (sources.has(to) || proposed.some((p) => normalizePath(p.from) === to)) { fail("New URL is itself redirected (a chain)"); continue; }
    seen.add(from);
    ok.push({ from, to });
  }
  return { ok, issues };
}

/** Finds a redirect for a request path using the same normalisation as storage. */
export function lookup(map: Map<string, string>, pathname: string, search = ""): string | null {
  const p = normalizePath(pathname);
  if (!p) return null;
  if (search) {
    const withQuery = map.get(p + search.toLowerCase());
    if (withQuery) return withQuery;
  }
  return map.get(p) ?? null;
}
