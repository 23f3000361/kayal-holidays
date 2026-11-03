"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { inputClass, cx } from "@/components/ui";

export function PackageFilter({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue ?? "");
  useEffect(() => {
    // Only when the text changed; replacing on mount would cancel a click made in the first 250 ms.
    if (q === (defaultValue ?? "")) return;
    const t = setTimeout(() => router.replace(q ? `/admin/packages?q=${encodeURIComponent(q)}` : "/admin/packages"), 250);
    return () => clearTimeout(t);
  }, [q, router, defaultValue]);
  return (
    <div className="relative max-w-sm">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, code or region" aria-label="Search packages" className={cx(inputClass, "pl-9")} />
    </div>
  );
}
