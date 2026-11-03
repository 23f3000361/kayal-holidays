/**
 * Edit-conflict detection for drafts. Each editor remembers a fingerprint of the draft it
 * loaded (or last saved). A save is accepted only if the stored draft still has that
 * fingerprint; otherwise someone else saved in between and we refuse instead of
 * silently overwriting their work. Content-based, so publishing or renaming doesn't
 * cause false alarms.
 */

/** Stable JSON: object keys sorted, so equal content always gives the same string. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** 53-bit cyrb53 hash as hex. Not for security; only to notice that a draft changed. */
export function fingerprint(content: unknown): string {
  const s = stableStringify(content);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export type Conflict = { by: string; at: Date };

export function conflictMessage(c: Conflict): string {
  const at = c.at.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  return `${c.by} saved this draft at ${at} while you were editing. Your changes are still on screen: copy anything you need, then reload to see theirs.`;
}
