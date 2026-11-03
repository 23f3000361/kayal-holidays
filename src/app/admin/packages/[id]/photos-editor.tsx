"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2, Upload } from "lucide-react";
import type { PackageContent } from "@/lib/package-content";
import { Alert, Spinner, inputClass, cx } from "@/components/ui";
import { move } from "./fields";

type Photo = PackageContent["photos"][number];
export type LibraryItem = { src: string; alt: string };

/** Resize in the browser so uploads stay small on slow connections (max 1600px, WebP). */
async function resize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode"))), "image/webp", 0.82));
  return { blob, width: w, height: h };
}

export function PhotosEditor({ value, onChange, library, canUpload, compact }: { value: Photo[]; onChange: (v: Photo[]) => void; library: LibraryItem[]; canUpload: boolean; compact?: boolean }) {
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<LibraryItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const all = [...extra, ...library];
  const chosen = new Set(value.map((p) => p.src));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        const { blob, width, height } = await resize(file);
        const body = new FormData();
        body.append("file", blob, file.name.replace(/\.\w+$/, ".webp"));
        body.append("width", String(width));
        body.append("height", String(height));
        const res = await fetch("/api/media", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        const item = { src: json.src as string, alt: "" };
        setExtra((x) => [item, ...x]);
        onChange([...value, item]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-muted">No photos yet. The first photo becomes the full-width cover.</p>
      ) : (
        <ul className={cx("grid gap-4", !compact && "sm:grid-cols-2 xl:grid-cols-3")}>
          {value.map((p, i) => (
            <li key={p.src} className="overflow-hidden rounded-lg border border-line">
              <div className="relative aspect-[4/3] bg-sand">
                <Image src={p.src} alt={p.alt} fill sizes="300px" className="object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs text-white">Cover</span>}
              </div>
              <div className="space-y-2 p-2">
                <input value={p.alt} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} placeholder="Describe the photo (for search and screen readers)" aria-label="Photo description" className={cx(inputClass, "py-1.5 text-sm", !p.alt && "border-warn")} />
                <div className="flex justify-between">
                  <div className="flex">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => onChange(move(value, i, -1))} className="rounded-md p-1.5 text-muted hover:bg-sand disabled:opacity-30"><ArrowLeft size={15} /></button>
                    <button type="button" aria-label="Move later" disabled={i === value.length - 1} onClick={() => onChange(move(value, i, 1))} className="rounded-md p-1.5 text-muted hover:bg-sand disabled:opacity-30"><ArrowRight size={15} /></button>
                  </div>
                  <button type="button" aria-label="Remove photo" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted hover:bg-sand hover:text-danger"><Trash2 size={15} /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPicking((p) => !p)} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-2 hover:bg-paper"><ImagePlus size={15} /> {picking ? "Close library" : "Choose from library"}</button>
        {canUpload && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink-2 hover:bg-paper">
            {uploading ? <Spinner /> : <Upload size={15} />} {uploading ? "Uploading…" : "Upload photos"}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      {picking && (
        <ul className={cx("grid max-h-96 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-line p-2", !compact && "sm:grid-cols-4 lg:grid-cols-6")}>
          {all.map((p) => (
            <li key={p.src}>
              <button type="button" disabled={chosen.has(p.src)} onClick={() => onChange([...value, p])} className="relative block aspect-square w-full overflow-hidden rounded-md bg-sand disabled:opacity-40" aria-label={`Add ${p.alt || p.src}`}>
                <Image src={p.src} alt="" fill sizes="120px" className="object-cover" />
                {chosen.has(p.src) && <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-xs text-white">Added</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
