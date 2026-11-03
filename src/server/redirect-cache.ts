import { createClient } from "@libsql/client";
import { lookup, normalizePath } from "@/lib/redirects";

/**
 * Redirect lookup for the proxy. Deliberately free of "server-only" and the shared Drizzle
 * client so it bundles cleanly into the proxy. The table is small, so it is cached in
 * memory and refreshed every 30 seconds; admin changes take effect within that window.
 */
const TTL_MS = 30_000;
const client = createClient({ url: process.env.DATABASE_URL ?? "file:./data/kayal.db", authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
let cache: { at: number; map: Map<string, string> } | null = null;
let loading: Promise<Map<string, string>> | null = null;

async function load() {
  const rs = await client.execute("select from_path, to_path from redirects");
  const map = new Map(rs.rows.map((r) => [String(r.from_path), String(r.to_path)]));
  cache = { at: Date.now(), map };
  return map;
}

export async function findRedirect(pathname: string, search: string): Promise<{ from: string; to: string } | null> {
  let map = cache && Date.now() - cache.at < TTL_MS ? cache.map : null;
  if (!map) {
    try {
      loading ??= load().finally(() => (loading = null));
      map = await loading;
    } catch {
      return null; // never break the site because the redirect table is unreachable
    }
  }
  const to = lookup(map, pathname, search);
  return to ? { from: pathname, to } : null;
}

export async function countHit(pathname: string, search: string) {
  const p = normalizePath(pathname);
  if (!p) return;
  try {
    await client.execute({ sql: "update redirects set hits = hits + 1, last_hit_at = ? where from_path in (?, ?)", args: [Date.now(), p + search.toLowerCase(), p] });
  } catch {
    // analytics only; never fail the redirect
  }
}
