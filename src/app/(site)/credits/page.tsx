import type { Metadata } from "next";
import credits from "@/data/photo-credits.json";

export const metadata: Metadata = { title: "Photo credits", robots: { index: false } };

export default function CreditsPage() {
  const rows = Object.entries(credits as Record<string, { title: string; page: string; author: string; licence: string; licenceUrl: string }>);
  return (
    <div className="container-page max-w-3xl pt-14">
      <h1 className="font-display text-4xl text-ink">Photo credits</h1>
      <p className="mt-3 text-muted">Photographs are from Wikimedia Commons under the licences shown. Images were resized for the web.</p>
      <ul className="mt-8 divide-y divide-line text-sm">
        {rows.map(([key, c]) => (
          <li key={key} className="py-3">
            <a href={c.page} className="text-ink hover:underline" rel="noopener noreferrer" target="_blank">{c.title.replace(/^File:/, "")}</a>
            <p className="text-muted">
              by {c.author} · {c.licenceUrl ? <a href={c.licenceUrl} className="hover:underline" rel="noopener noreferrer" target="_blank">{c.licence}</a> : c.licence}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
