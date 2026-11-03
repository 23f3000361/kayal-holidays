import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl text-gold">404</p>
      <h1 className="mt-4 font-display text-3xl text-ink">This page has drifted off</h1>
      <p className="mt-2 max-w-sm text-muted">The page may have moved when we rebuilt the site. Our packages are all still here.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/packages" className={buttonClass("primary")}>See packages</Link>
        <Link href="/" className={buttonClass("ghost")}>Home</Link>
      </div>
    </main>
  );
}
