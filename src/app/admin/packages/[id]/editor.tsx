"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Copy, Eye, History, Link2, MapPin, MoreHorizontal, Plus, Save, Trash2, ArrowUp, ArrowDown, EyeOff } from "lucide-react";
import { saveDraftAction, publishAction, unpublishAction, duplicateAction, previewLinkAction, identityAction } from "@/app/admin/actions";
import { THEMES, REGIONS, HOTEL_CATEGORIES, publishProblems, type PackageContent } from "@/lib/package-content";
import { seasonCoverage } from "@/lib/pricing";
import { PLACES, PLACE_COORDS } from "@/lib/ai/gazetteer";
import { Alert, Badge, Button, Field, Spinner, inputClass, cx } from "@/components/ui";
import { Counter, LinesEditor, Section, SeasonsEditor, TagsEditor, move } from "./fields";
import { PhotosEditor, type LibraryItem } from "./photos-editor";
import { PublishDialog } from "./publish-dialog";

type Props = {
  id: string; code: string; slug: string; draft: PackageContent; live: PackageContent | null; liveVersion: number | null;
  statusLabel: string; scheduledAt: string | null; hasReleases: boolean; library: LibraryItem[]; canEdit: boolean; canPublish: boolean; canUpload: boolean; savedAt: string;
};

const SECTIONS = [
  ["basics", "Basics"], ["prices", "Prices"], ["itinerary", "Day by day"], ["included", "Included"], ["hotels", "Hotels"], ["photos", "Photos"], ["map", "Map"], ["seo", "Search & address"],
] as const;

export function PackageEditor(p: Props) {
  const router = useRouter();
  const [c, setC] = useState<PackageContent>(p.draft);
  const [saved, setSaved] = useState<PackageContent>(p.draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [menu, setMenu] = useState(false);
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);
  const problems = useMemo(() => publishProblems(c, seasonCoverage), [c]);
  const set = <K extends keyof PackageContent>(k: K, v: PackageContent[K]) => setC((x) => ({ ...x, [k]: v }));
  const ro = !p.canEdit;

  const save = useCallback(
    (then?: () => void) =>
      startSave(async () => {
        const r = await saveDraftAction(p.id, c);
        if (r.ok) {
          setSaved(c);
          setErrors({});
          setFlash({ ok: true, text: "Draft saved" });
          router.refresh();
          then?.();
        } else {
          const map: Record<string, string> = {};
          for (const e of r.fieldErrors ?? []) map[e.path] ??= e.message;
          setErrors(map);
          setFlash({ ok: false, text: `${r.error} ${Object.values(map).slice(0, 2).join(" ")}` });
        }
      }),
    [c, p.id, router],
  );

  // Ctrl/Cmd+S saves; leaving with unsaved changes asks first.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !ro) save();
      }
    };
    const leave = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("beforeunload", leave); };
  }, [dirty, ro, save]);

  useEffect(() => {
    if (!flash?.ok) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const preview = () => (dirty ? save(() => window.open(`/admin/packages/${p.id}/preview`, "_blank")) : window.open(`/admin/packages/${p.id}/preview`, "_blank"));
  const err = (path: string) => errors[path];
  const errorCount = problems.filter((x) => x.level === "error").length;

  const syncDays = () => {
    const days = Array.from({ length: c.durationDays }, (_, i) => c.itinerary[i] ?? { day: i + 1, title: "", description: "", overnight: "", meals: "" }).map((d, i) => ({ ...d, day: i + 1 }));
    set("itinerary", days);
  };
  const fillMap = () => set("mapStops", c.destinations.filter((d) => PLACE_COORDS[d]).map((d) => ({ name: d, ...PLACE_COORDS[d] })));

  return (
    <div>
      {/* Sticky action bar */}
      <div className="sticky top-[104px] z-20 border-b border-line bg-surface/95 backdrop-blur lg:top-0">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Badge tone={p.statusLabel === "Published" ? "ok" : p.statusLabel === "Changes not published" ? "warn" : "neutral"}>{p.statusLabel}{p.liveVersion ? ` · v${p.liveVersion} live` : ""}</Badge>
            {p.scheduledAt && <Badge tone="info">Scheduled {new Date(p.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Badge>}
            <span className="hidden text-sm text-muted sm:inline" aria-live="polite">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved to draft"}</span>
            {flash && <span role="status" className={cx("text-sm", flash.ok ? "text-ok" : "text-danger")}>{flash.text}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={preview}><Eye size={15} /> Preview</Button>
            {!ro && <Button variant="secondary" size="sm" onClick={() => save()} disabled={!dirty || saving}>{saving ? <Spinner /> : <Save size={15} />} Save draft</Button>}
            {p.canPublish && <Button size="sm" onClick={() => (dirty ? save(() => setPublishing(true)) : setPublishing(true))}>Publish…</Button>}
            <div className="relative">
              <Button variant="ghost" size="sm" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal size={16} /></Button>
              {menu && (
                <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-lift)]" onMouseLeave={() => setMenu(false)}>
                  <Link href={`/admin/packages/${p.id}/history`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sand"><History size={15} /> Version history</Link>
                  <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-sand" onClick={() => startBusy(async () => { const r = await previewLinkAction(p.id); if (r.ok) { await navigator.clipboard.writeText(r.data!); setFlash({ ok: true, text: "Preview link copied (valid 7 days)" }); } setMenu(false); })}><Link2 size={15} /> Copy preview link</button>
                  {!ro && <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-sand" onClick={() => startBusy(() => duplicateAction(p.id))}><Copy size={15} /> Duplicate package</button>}
                  {p.canPublish && p.liveVersion && <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft" onClick={() => { if (confirm("Take this package off the website? It stays in the CMS and can be published again.")) startBusy(async () => { const r = await unpublishAction(p.id); setFlash(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error }); setMenu(false); router.refresh(); }); }}><EyeOff size={15} /> Unpublish</button>}
                  {busy && <p className="px-3 py-2 text-xs text-muted"><Spinner /> Working…</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[180px_minmax(0,1fr)_280px]">
        <nav className="hidden lg:block" aria-label="Editor sections">
          <ul className="sticky top-24 space-y-0.5 text-sm">
            {SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className="block rounded-md px-3 py-1.5 text-ink-2 hover:bg-sand">{label}</a></li>)}
          </ul>
        </nav>

        <fieldset disabled={ro} className="min-w-0 space-y-6">
          {ro && <Alert tone="info">You can view this package. Only editors and admins can change it.</Alert>}
          <Section id="basics" title="Basics" description="What travellers see first.">
            <Field label="Title" htmlFor="title" error={err("title")}>
              <input id="title" value={c.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
            </Field>
            <Field label="One-line summary" htmlFor="summary" error={err("summary")} hint={<span className="flex justify-between"><span>Shown under the title and in search results.</span><Counter value={c.summary} max={400} /></span>}>
              <textarea id="summary" rows={2} value={c.summary} onChange={(e) => set("summary", e.target.value)} className={inputClass} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Region" htmlFor="region">
                <select id="region" value={c.region} onChange={(e) => set("region", e.target.value as PackageContent["region"])} className={inputClass}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
              </Field>
              <Field label="Length in days" htmlFor="days" error={err("durationDays")} hint={`${Math.max(0, c.durationDays - 1)} nights`}>
                <input id="days" type="number" min={1} max={30} value={c.durationDays} onChange={(e) => set("durationDays", Math.max(1, Math.round(Number(e.target.value))))} className={inputClass} />
              </Field>
            </div>
            <Field label="Route (in order)" error={err("destinations")}>
              <TagsEditor value={c.destinations} onChange={(v) => set("destinations", v)} suggestions={PLACES.map((x) => x.name)} />
            </Field>
            <div>
              <p className="text-sm font-medium text-ink-2">Experiences</p>
              <p className="text-xs text-muted">Used for search filters and to match enquiries (e.g. &ldquo;houseboat a must&rdquo;).</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {THEMES.map((t) => (
                  <button key={t} type="button" aria-pressed={c.themes.includes(t)} onClick={() => set("themes", c.themes.includes(t) ? c.themes.filter((x) => x !== t) : [...c.themes, t])} className={cx("rounded-full border px-3 py-1 text-sm capitalize transition-colors", c.themes.includes(t) ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:border-line-strong")}>{t}</button>
                ))}
              </div>
            </div>
            <Field label="Highlights"><LinesEditor value={c.highlights} onChange={(v) => set("highlights", v)} placeholder="e.g. A private houseboat night" max={8} /></Field>
          </Section>

          <Section id="prices" title="Prices by season" description="Per person, twin sharing, in whole rupees, before GST. A season can run across New Year (e.g. 1 Oct to 31 Mar).">
            <SeasonsEditor value={c.seasons} onChange={(v) => set("seasons", v)} errors={errors} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Child price (% of adult)" htmlFor="child" hint="Children 5–11 sharing their parents' room">
                <input id="child" type="number" min={0} max={100} value={c.childPercent} onChange={(e) => set("childPercent", Math.round(Number(e.target.value)))} className={inputClass} />
              </Field>
              <Field label="GST %" htmlFor="gst" hint="Tour packages: 5% (assumed; confirm with the accountant)">
                <input id="gst" type="number" min={0} max={28} step={0.5} value={c.gstPercent} onChange={(e) => set("gstPercent", Number(e.target.value))} className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section id="itinerary" title="Day by day" description={`${c.itinerary.length} of ${c.durationDays} days written.`}>
            {c.itinerary.length !== c.durationDays && (
              <Alert tone="warn"><span className="flex flex-wrap items-center justify-between gap-2">The itinerary has {c.itinerary.length} days but the package is {c.durationDays} days.<Button size="sm" variant="secondary" type="button" onClick={syncDays}>Match to {c.durationDays} days</Button></span></Alert>
            )}
            <ol className="space-y-4">
              {c.itinerary.map((d, i) => {
                const upd = (patch: Partial<typeof d>) => set("itinerary", c.itinerary.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <li key={i} className="rounded-lg border border-line p-4">
                    <div className="flex items-center justify-between">
                      <p className="tabular text-sm font-medium text-ink">Day {i + 1}</p>
                      <div className="flex">
                        <button type="button" aria-label="Move day up" disabled={i === 0} onClick={() => set("itinerary", move(c.itinerary, i, -1).map((x, k) => ({ ...x, day: k + 1 })))} className="rounded-md p-1.5 text-muted hover:bg-sand disabled:opacity-30"><ArrowUp size={15} /></button>
                        <button type="button" aria-label="Move day down" disabled={i === c.itinerary.length - 1} onClick={() => set("itinerary", move(c.itinerary, i, 1).map((x, k) => ({ ...x, day: k + 1 })))} className="rounded-md p-1.5 text-muted hover:bg-sand disabled:opacity-30"><ArrowDown size={15} /></button>
                        <button type="button" aria-label="Remove day" onClick={() => set("itinerary", c.itinerary.filter((_, j) => j !== i).map((x, k) => ({ ...x, day: k + 1 })))} className="rounded-md p-1.5 text-muted hover:bg-sand hover:text-danger"><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <input aria-label={`Day ${i + 1} title`} value={d.title} onChange={(e) => upd({ title: e.target.value })} placeholder="e.g. Kochi to Munnar" className={cx(inputClass, "font-medium")} />
                      <textarea aria-label={`Day ${i + 1} description`} rows={3} value={d.description} onChange={(e) => upd({ description: e.target.value })} placeholder="What happens this day" className={inputClass} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input aria-label={`Day ${i + 1} overnight`} value={d.overnight} onChange={(e) => upd({ overnight: e.target.value })} placeholder="Overnight (e.g. Munnar)" className={inputClass} />
                        <input aria-label={`Day ${i + 1} meals`} value={d.meals} onChange={(e) => upd({ meals: e.target.value })} placeholder="Meals (e.g. Breakfast, dinner)" className={inputClass} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button type="button" onClick={() => set("itinerary", [...c.itinerary, { day: c.itinerary.length + 1, title: "", description: "", overnight: "", meals: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-ink-2 hover:border-accent hover:text-accent"><Plus size={14} /> Add a day</button>
          </Section>

          <Section id="included" title="Included and not included">
            <Field label="Included"><LinesEditor value={c.inclusions} onChange={(v) => set("inclusions", v)} placeholder="e.g. Daily breakfast and dinner" /></Field>
            <Field label="Not included"><LinesEditor value={c.exclusions} onChange={(v) => set("exclusions", v)} placeholder="e.g. Flights" /></Field>
          </Section>

          <Section id="hotels" title="Hotels" description="Hotel names are optional; the class is what we promise.">
            {c.hotels.map((h, i) => {
              const upd = (patch: Partial<typeof h>) => set("hotels", c.hotels.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_130px_90px_32px] sm:items-center">
                  <input aria-label="Location" value={h.location} onChange={(e) => upd({ location: e.target.value })} placeholder="Location" className={inputClass} />
                  <input aria-label="Hotel name" value={h.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Hotel (optional)" className={inputClass} />
                  <select aria-label="Category" value={h.category} onChange={(e) => upd({ category: e.target.value })} className={inputClass}>{HOTEL_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select>
                  <input aria-label="Nights" type="number" min={1} value={h.nights} onChange={(e) => upd({ nights: Math.max(1, Math.round(Number(e.target.value))) })} className={inputClass} />
                  <button type="button" aria-label="Remove hotel" onClick={() => set("hotels", c.hotels.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted hover:bg-sand hover:text-danger"><Trash2 size={15} /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => set("hotels", [...c.hotels, { location: c.destinations[c.hotels.length] ?? "", name: "", category: "4 star", nights: 1 }])} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-ink-2 hover:border-accent hover:text-accent"><Plus size={14} /> Add a hotel</button>
            {c.hotels.length > 0 && <p className="text-xs text-muted">{c.hotels.reduce((s, h) => s + h.nights, 0)} hotel nights for a {c.durationDays - 1}-night package.</p>}
          </Section>

          <Section id="photos" title="Photos" description="The first photo is the full-width cover. Landscape photos work best.">
            <PhotosEditor value={c.photos} onChange={(v) => set("photos", v)} library={p.library} canUpload={p.canUpload} />
          </Section>

          <Section id="map" title="Route map" description="Stops shown on the map, in order.">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={fillMap}><MapPin size={14} /> Fill from route</Button>
              <span className="self-center text-xs text-muted">{c.mapStops.map((s) => s.name).join(" → ") || "No stops yet"}</span>
            </div>
            {c.destinations.some((d) => !PLACE_COORDS[d]) && <p className="text-xs text-muted">No coordinates known for {c.destinations.filter((d) => !PLACE_COORDS[d]).join(", ")}; add them by hand below.</p>}
            {c.mapStops.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_32px] items-center gap-2">
                <input aria-label="Stop name" value={s.name} onChange={(e) => set("mapStops", c.mapStops.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputClass} />
                <input aria-label="Latitude" type="number" step="0.0001" value={s.lat} onChange={(e) => set("mapStops", c.mapStops.map((x, j) => (j === i ? { ...x, lat: Number(e.target.value) } : x)))} className={inputClass} />
                <input aria-label="Longitude" type="number" step="0.0001" value={s.lng} onChange={(e) => set("mapStops", c.mapStops.map((x, j) => (j === i ? { ...x, lng: Number(e.target.value) } : x)))} className={inputClass} />
                <button type="button" aria-label="Remove stop" onClick={() => set("mapStops", c.mapStops.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted hover:bg-sand hover:text-danger"><Trash2 size={15} /></button>
              </div>
            ))}
          </Section>

          <Section id="seo" title="Search and web address" description="How the page appears on Google.">
            <div className="rounded-lg border border-line bg-paper p-4">
              <p className="truncate text-xs text-ok">kayal.example.com › packages › {p.slug}</p>
              <p className="truncate text-lg text-info">{c.seoTitle || c.title || "Package title"}</p>
              <p className="line-clamp-2 text-sm text-muted">{c.seoDescription || c.summary || "Summary"}</p>
            </div>
            <Field label="Search title" htmlFor="seoTitle" hint={<span className="flex justify-between"><span>Leave empty to use the title</span><Counter value={c.seoTitle} max={70} /></span>}>
              <input id="seoTitle" value={c.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputClass} />
            </Field>
            <Field label="Search description" htmlFor="seoDescription" hint={<span className="flex justify-between"><span>Leave empty to use the summary</span><Counter value={c.seoDescription} max={170} /></span>}>
              <textarea id="seoDescription" rows={2} value={c.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className={inputClass} />
            </Field>
            <IdentityForm id={p.id} code={p.code} slug={p.slug} locked={p.hasReleases} />
          </Section>
        </fieldset>

        {/* Checklist */}
        <aside className="space-y-4">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                {errorCount === 0 ? <CheckCircle2 size={16} className="text-ok" /> : <AlertCircle size={16} className="text-danger" />}
                {errorCount === 0 ? "Ready to publish" : `${errorCount} thing${errorCount > 1 ? "s" : ""} to fix before publishing`}
              </p>
              {problems.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm">
                  {problems.map((x) => <li key={x.message} className={cx("flex gap-2", x.level === "error" ? "text-danger" : "text-warn")}><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />{x.message}</li>)}
                </ul>
              )}
            </div>
            <p className="px-1 text-xs text-muted">Last saved {new Date(p.savedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. Ctrl+S saves the draft.</p>
          </div>
        </aside>
      </div>

      {p.canPublish && (
        <PublishDialog
          open={publishing}
          onClose={() => setPublishing(false)}
          draft={c}
          live={p.live}
          problems={problems}
          onPublish={async (input) => {
            const r = await publishAction(p.id, input);
            if (!r.ok) return r.error;
            setPublishing(false);
            setFlash({ ok: true, text: r.data!.scheduled ? `Scheduled v${r.data!.versionNo}` : `Published v${r.data!.versionNo}. The website is updated.` });
            router.refresh();
            return null;
          }}
        />
      )}
    </div>
  );
}

function IdentityForm({ id, code, slug, locked }: { id: string; code: string; slug: string; locked: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ code, slug });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = v.code !== code || v.slug !== slug;
  return (
    <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-[160px_1fr_auto] sm:items-end">
      <Field label="Package code" htmlFor="code"><input id="code" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} className={inputClass} /></Field>
      <Field label="Web address" htmlFor="slug" hint={locked ? "Locked after first publish so links and Google rankings don't break." : undefined}>
        <div className="flex items-center rounded-lg border border-line-strong bg-surface pl-3 focus-within:border-accent">
          <span className="shrink-0 text-sm text-faint">/packages/</span>
          <input id="slug" value={v.slug} disabled={locked} onChange={(e) => setV({ ...v, slug: e.target.value })} className="w-full bg-transparent px-1 py-2 text-[15px] focus:outline-none disabled:text-muted" />
        </div>
      </Field>
      <Button type="button" variant="secondary" disabled={!changed || pending} onClick={() => start(async () => { const r = await identityAction(id, v); setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.error }); if (r.ok) router.refresh(); })}>{pending && <Spinner />} Save</Button>
      {msg && <p role="status" className={cx("text-sm sm:col-span-3", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}
