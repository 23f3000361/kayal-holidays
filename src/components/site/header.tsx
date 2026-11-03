"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClass, cx } from "@/components/ui";

const NAV = [
  { href: "/packages", label: "Packages" },
  { href: "/destinations/kerala", label: "Kerala" },
  { href: "/destinations/tamil-nadu", label: "Tamil Nadu" },
  { href: "/destinations/karnataka", label: "Karnataka" },
  { href: "/blog", label: "Journal" },
];

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link href="/" className={cx("font-display text-[22px] font-medium tracking-tight", light ? "text-white" : "text-ink")} aria-label="Kayal Holidays, home">
      Kayal<span className={light ? "text-white/70" : "text-gold"}>.</span>
    </Link>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const overlay = path === "/";
  // The menu belongs to the path it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  const light = overlay && !scrolled && !open;
  return (
    <header className={cx("top-0 z-40 w-full transition-colors duration-300", overlay ? "fixed" : "sticky", light ? "bg-transparent" : "border-b border-line bg-paper/95 backdrop-blur")}>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo light={light} />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cx("text-sm transition-colors", light ? "text-white/90 hover:text-white" : path.startsWith(n.href) ? "text-ink" : "text-muted hover:text-ink")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cx("hidden text-sm sm:block", light ? "text-white/80 hover:text-white" : "text-muted hover:text-ink")}>
            Sign in
          </Link>
          <Link href="/enquire" className={cx(buttonClass("primary", "sm"), "hidden sm:inline-flex", light && "bg-white text-ink hover:bg-white/90")}>
            Plan a trip
          </Link>
          <button className={cx("rounded-md p-2 md:hidden", light ? "text-white" : "text-ink")} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpenOn(open ? null : path)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper md:hidden" aria-label="Mobile">
          <div className="container-page flex flex-col py-3">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="py-3 text-base text-ink">
                {n.label}
              </Link>
            ))}
            <Link href="/login" className="py-3 text-base text-muted">
              Sign in
            </Link>
            <Link href="/enquire" className={cx(buttonClass("primary", "lg"), "mt-2")}>
              Plan a trip
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
