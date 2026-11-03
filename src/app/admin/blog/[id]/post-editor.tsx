"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bold, CheckCircle2, Eye, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Package, Quote, Save, Sparkles, X } from "lucide-react";
import { publishPostAction, savePostAction, suggestRelatedAction, unpublishPostAction, postSlugAction } from "../actions";
import { postProblems, type PostContent } from "@/lib/blog";
import { readingMinutes } from "@/lib/markdown";
import type { PackageContent } from "@/lib/package-content";
import { Markdown } from "@/components/site/markdown";
import { Alert, Badge, Button, Field, Spinner, inputClass, cx } from "@/components/ui";
import { Counter } from "@/app/admin/packages/[id]/fields";
import { PhotosEditor, type LibraryItem } from "@/app/admin/packages/[id]/photos-editor";

type Pkg = { slug: string; code: string; content: PackageContent };
type Props = { draftHash: string; id: string; slug: string; draft: PostContent; status: string; live: boolean; publishAt: string | null; categories: string[]; packages: Pkg[]; library: LibraryItem[] };
type Suggestion = { slug: string; title: string; score: number; why: string };

export function PostEditor(p: Props) {
  const router = useRouter();
  const [c, setC] = useState<PostContent>(p.draft);
  const [saved, setSaved] = useState<PostContent>(p.draft);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [base, setBase] = useState(p.draftHash);
  const [conflict, setConflict] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [when, setWhen] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);
  const problems = useMemo(() => postProblems(c), [c]);
  const set = <K extends keyof PostContent>(k: K, v: PostContent[K]) => setC((x) => ({ ...x, [k]: v }));
  const pkgBySlug = useMemo(() => new Map(p.packages.map((x) => [x.slug, x])), [p.packages]);

  const save = useCallback(
    (then?: () => void) =>
      startSave(async () => {
        const r = await savePostAction(p.id, c, base);
        if (r.ok) {
          setBase(r.data!.hash);
          setConflict(null);
          setSaved(c);
          setErrors({});
          setFlash({ ok: true, text: "Draft saved" });
          router.refresh();
          then?.();
        } else if (r.conflict) {
          setConflict(r.error);
        } else {
          const map: Record<string, string> = {};
          for (const e of r.fieldErrors ?? []) map[e.path] ??= e.message;
          setErrors(map);
          setFlash({ ok: false, text: `${r.error} ${Object.values(map).slice(0, 2).join(" ")}` });
        }
      }),
    [c, p.id, router, base],
  );

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) save();
      }
    };
    const leave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("beforeunload", leave); };
  }, [dirty, save]);

  /** Wraps the selection, or inserts a block on its own line. */
  const edit = (kind: "wrap" | "line" | "block", before: string, after = "", placeholder = "text") => {
    // Looked up at click time, so nothing reads the DOM during render.
    const ta = document.getElementById("body") as HTMLTextAreaElement | null;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    let next: string;
    let cursor: number;
    if (kind === "wrap") {
      next = value.slice(0, s) + before + sel + after + value.slice(e);
      cursor = s + before.length + sel.length + after.length;
    } else if (kind === "line") {
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const lines = value.slice(lineStart, e).split("\n").map((l, i) => (before === "1. " ? `${i + 1}. ` : before) + l.replace(/^(#{2,3} |> |- |\d+\. )/, ""));
      next = value.slice(0, lineStart) + lines.join("\n") + value.slice(e);
      cursor = lineStart + lines.join("\n").length;
    } else {
      const pad = (value.slice(0, s).endsWith("\n\n") || s === 0 ? "" : "\n\n");
      next = value.slice(0, s) + pad + before + "\n\n" + value.slice(e);
      cursor = s + pad.length + before.length + 2;
    }
    set("body", next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(cursor, cursor); });
  };

  const tool = (label: string, Icon: typeof Bold, fn: () => void) => (
    <button type="button" title={label} aria-label={label} onClick={fn} className="rounded-md p-1.5 text-ink-2 hover:bg-sand"><Icon size={16} /></button>
  );

  const publish = () =>
    startBusy(async () => {
      const go = async () => {
        const r = await publishPostAction(p.id, when ? new Date(when).toISOString() : undefined);
        if (!r.ok) return setFlash({ ok: false, text: r.error });
        setPublishing(false);
        setFlash({ ok: true, text: r.data!.scheduled ? "Scheduled" : p.live ? "Live post updated" : "Published. The post is on the site." });
        router.refresh();
      };
      if (dirty) {
        const r = await savePostAction(p.id, c, base);
        if (!r.ok) return r.conflict ? setConflict(r.error) : setFlash({ ok: false, text: r.error });
        setBase(r.data!.hash);
        setSaved(c);
      }
      await go();
    });

  const relatedSet = new Set(c.relatedPackages);
  const toggleRelated = (slug: string) => set("relatedPackages", relatedSet.has(slug) ? c.relatedPackages.filter((s) => s !== slug) : [...c.relatedPackages, slug].slice(0, 4));

  return (
    <div>
      {conflict && (
        <div role="alert" className="border-b border-danger/30 bg-danger-soft">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-danger sm:px-8">
            <p><b>Not saved.</b> {conflict}</p>
            <Button size="sm" variant="danger" onClick={() => window.location.reload()}>Reload the latest draft</Button>
          </div>
        </div>
      )}
      <div className="sticky top-[104px] z-20 border-b border-line bg-surface/95 backdrop-blur lg:top-0">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={p.status === "Published" ? "ok" : p.status === "Scheduled" ? "info" : p.status === "Draft" ? "neutral" : "warn"}>{p.status}{p.status === "Scheduled" && p.publishAt ? ` · ${new Date(p.publishAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}</Badge>
            <span className="text-sm text-muted" aria-live="polite">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved to draft"}</span>
            {flash && <span role="status" className={cx("text-sm", flash.ok ? "text-ok" : "text-danger")}>{flash.text}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => (dirty ? save(() => window.open(`/admin/blog/${p.id}/preview`, "_blank")) : window.open(`/admin/blog/${p.id}/preview`, "_blank"))}><Eye size={15} /> Preview</Button>
            <Button variant="secondary" size="sm" onClick={() => save()} disabled={!dirty || saving}>{saving ? <Spinner /> : <Save size={15} />} Save draft</Button>
            <Button size="sm" onClick={() => setPublishing((x) => !x)}>{p.live ? "Update live post…" : "Publish…"}</Button>
          </div>
        </div>
        {publishing && (
          <div className="border-t border-line bg-paper">
            <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-3 px-4 py-3 sm:px-8">
              {problems.length > 0 ? (
                <p className="text-sm text-danger">Fix the items in the checklist first.</p>
              ) : (
                <>
                  {!p.live && (
                    <Field label="Go live at (leave empty for now)" htmlFor="when">
                      <input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={cx(inputClass, "w-auto")} />
                    </Field>
                  )}
                  {p.live && <p className="text-sm text-muted">Changes to a live post go live straight away.</p>}
                  <Button onClick={publish} disabled={busy}>{busy && <Spinner />} {p.live ? "Update now" : when ? "Schedule" : "Publish now"}</Button>
                </>
              )}
              {p.live && <Button variant="danger" disabled={busy} onClick={() => { if (confirm("Take this post off the site? It stays here as a draft.")) startBusy(async () => { const r = await unpublishPostAction(p.id); setFlash(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error }); setPublishing(false); router.refresh(); }); }}>Unpublish</Button>}
              <Button variant="ghost" onClick={() => setPublishing(false)}><X size={15} /> Close</Button>
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px]">
        {/* Writing */}
        <div className="min-w-0 space-y-5">
          <Field label="Title" htmlFor="title" error={errors.title}><input id="title" value={c.title} onChange={(e) => set("title", e.target.value)} className={cx(inputClass, "font-display text-xl")} /></Field>
          <Field label="Excerpt" htmlFor="excerpt" hint={<span className="flex justify-between"><span>One or two lines for the blog list and search results.</span><Counter value={c.excerpt} max={300} /></span>}>
            <textarea id="excerpt" rows={2} value={c.excerpt} onChange={(e) => set("excerpt", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Category" htmlFor="category" error={errors.category} hint="Pick one or type a new one.">
            <input id="category" list="cats" value={c.category} onChange={(e) => set("category", e.target.value)} className={cx(inputClass, "w-64")} />
            <datalist id="cats">{p.categories.map((x) => <option key={x} value={x} />)}</datalist>
          </Field>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="body" className="text-sm font-medium text-ink-2">Story</label>
              <div className="flex gap-1 xl:hidden" role="tablist">
                {(["write", "preview"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-md px-2.5 py-1 text-xs capitalize", tab === t ? "bg-ink text-white" : "text-muted")}>{t}</button>)}
              </div>
            </div>
            <div className={cx("mt-1.5 overflow-hidden rounded-lg border border-line-strong bg-surface focus-within:border-accent", tab === "preview" && "hidden xl:block")}>
              <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-paper px-1.5 py-1" role="toolbar" aria-label="Formatting">
                {tool("Heading", Heading2, () => edit("line", "## "))}
                {tool("Subheading", Heading3, () => edit("line", "### "))}
                {tool("Bold", Bold, () => edit("wrap", "**", "**"))}
                {tool("Italic", Italic, () => edit("wrap", "*", "*"))}
                {tool("Link", Link2, () => edit("wrap", "[", "](/packages/)", "link text"))}
                {tool("Bulleted list", List, () => edit("line", "- "))}
                {tool("Numbered list", ListOrdered, () => edit("line", "1. "))}
                {tool("Quote", Quote, () => edit("line", "> "))}
                <span className="mx-1 h-5 w-px bg-line" />
                <label className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-2 hover:bg-sand">
                  <ImageIcon size={15} />
                  <select aria-label="Insert photo" value="" onChange={(e) => { const it = p.library.find((x) => x.src === e.target.value); if (it) edit("block", `![${it.alt}](${it.src})`); }} className="max-w-28 bg-transparent focus:outline-none">
                    <option value="">Photo</option>
                    {p.library.map((x) => <option key={x.src} value={x.src}>{x.alt || x.src}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-2 hover:bg-sand">
                  <Package size={15} />
                  <select aria-label="Insert package card" value="" onChange={(e) => e.target.value && edit("block", `[[package:${e.target.value}]]`)} className="max-w-32 bg-transparent focus:outline-none">
                    <option value="">Package card</option>
                    {p.packages.map((x) => <option key={x.slug} value={x.slug}>{x.code} · {x.content.title}</option>)}
                  </select>
                </label>
              </div>
              <textarea id="body" value={c.body} onChange={(e) => set("body", e.target.value)} rows={26} spellCheck className="block w-full resize-y px-4 py-3 font-mono text-[13.5px] leading-relaxed text-ink focus:outline-none" placeholder={"## A heading\n\nWrite in plain sentences. Use the toolbar for headings, bold, links and lists.\n\nAdd a package card where readers should act."} />
            </div>
            <p className="mt-1 text-xs text-muted">{readingMinutes(c.body)} min read · formatting shows in the preview.</p>
          </div>
        </div>

        {/* Live preview */}
        <div className={cx("min-w-0", tab === "write" && "hidden xl:block")}>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Preview</p>
          <div className="max-h-[calc(100dvh-180px)] overflow-y-auto rounded-lg border border-line bg-paper px-5 py-6 xl:sticky xl:top-24">
            <h1 className="font-display text-3xl leading-tight text-ink">{c.title || "Untitled"}</h1>
            {c.excerpt && <p className="mt-2 text-lg text-muted">{c.excerpt}</p>}
            <div className="mt-6"><Markdown source={c.body || "*Nothing written yet.*"} packages={p.packages} /></div>
          </div>
        </div>

        {/* Side panel */}
        <aside className="space-y-5">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">{problems.length === 0 ? <CheckCircle2 size={16} className="text-ok" /> : <AlertCircle size={16} className="text-danger" />}{problems.length === 0 ? "Ready to publish" : "Before publishing"}</p>
            {problems.length > 0 && <ul className="mt-2 space-y-1.5 text-sm text-danger">{problems.map((x) => <li key={x}>{x}</li>)}</ul>}
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink">Cover photo</p>
            <div className="mt-3"><PhotosEditor value={c.cover ? [c.cover] : []} onChange={(v) => set("cover", v.length ? v[v.length - 1] : null)} library={p.library} canUpload compact /></div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink">Related packages</p>
            <p className="text-xs text-muted">Shown under the post as the next step. Up to 4.</p>
            <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={busy} onClick={() => startBusy(async () => { const r = await suggestRelatedAction({ title: c.title, body: c.body }); setSuggestions(r.ok ? r.data! : []); })}>
              <Sparkles size={14} className="text-gold" /> Suggest from the text
            </Button>
            {suggestions && (
              suggestions.length === 0 ? <p className="mt-2 text-xs text-muted">No clear match in the text yet. Mention places or experiences, or pick below.</p> : (
                <ul className="mt-2 space-y-2">
                  {suggestions.map((s) => (
                    <li key={s.slug} className="rounded-md bg-accent-soft/60 p-2 text-xs">
                      <p className="font-medium text-ink">{s.title}</p>
                      <p className="text-muted">{s.why}</p>
                      {!relatedSet.has(s.slug) && <button className="mt-1 font-medium text-accent hover:underline" onClick={() => toggleRelated(s.slug)}>Add</button>}
                    </li>
                  ))}
                </ul>
              )
            )}
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {p.packages.map((x) => (
                <li key={x.slug}>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={relatedSet.has(x.slug)} disabled={!relatedSet.has(x.slug) && c.relatedPackages.length >= 4} onChange={() => toggleRelated(x.slug)} className="mt-1 accent-[var(--color-accent)]" />
                    <span className="text-ink-2">{x.content.title}</span>
                  </label>
                </li>
              ))}
            </ul>
            {c.relatedPackages.some((s) => !pkgBySlug.has(s)) && <Alert tone="warn">A linked package is no longer live and will be hidden.</Alert>}
          </div>

          <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink">Search</p>
            <Field label="Search title" htmlFor="seoTitle" hint={<Counter value={c.seoTitle} max={70} />}><input id="seoTitle" value={c.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputClass} /></Field>
            <Field label="Search description" htmlFor="seoDescription" hint={<Counter value={c.seoDescription} max={170} />}><textarea id="seoDescription" rows={3} value={c.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className={inputClass} /></Field>
            <SlugField id={p.id} slug={p.slug} locked={p.status !== "Draft"} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SlugField({ id, slug, locked }: { id: string; slug: string; locked: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(slug);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Field label="Web address" htmlFor="slug" hint={locked ? "Locked once published, so links keep working." : `/blog/${v}`}>
      <div className="flex gap-2">
        <input id="slug" value={v} disabled={locked} onChange={(e) => setV(e.target.value)} className={inputClass} />
        {!locked && <Button type="button" size="sm" variant="secondary" disabled={v === slug || pending} onClick={() => start(async () => { const r = await postSlugAction(id, v); setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error }); if (r.ok) router.refresh(); })}>Save</Button>}
      </div>
      {msg && <p className={cx("mt-1 text-xs", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
    </Field>
  );
}
