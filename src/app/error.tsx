"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-3xl text-ink">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted">The page could not load. Your data is safe. Try again, and if it keeps happening, tell us the code below.</p>
      {error.digest && <p className="tabular mt-3 text-xs text-faint">Error {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </main>
  );
}
