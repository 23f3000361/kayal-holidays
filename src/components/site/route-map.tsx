"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Stop = { name: string; lat: number; lng: number };

/** Loads Leaflet only when the map scrolls into view, keeping the first load light on 4G. */
export function RouteMap({ stops }: { stops: Stop[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "ready" | "error">("idle");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        try {
          const L = await import("leaflet");
          if (cancelled) return;
          map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 12, attribution: "© OpenStreetMap contributors" }).addTo(map);
          const pts = stops.map((s) => L.latLng(s.lat, s.lng));
          L.polyline(pts, { color: "#1f4d3f", weight: 3, opacity: 0.8, dashArray: "6 6" }).addTo(map);
          stops.forEach((s, i) =>
            L.circleMarker([s.lat, s.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#1f4d3f", fillOpacity: 1 })
              .addTo(map!)
              .bindTooltip(`${i + 1}. ${s.name}`, { permanent: true, direction: "right", offset: [8, 0], className: "kayal-tip" }),
          );
          map.fitBounds(L.latLngBounds(pts).pad(0.35));
          setState("ready");
        } catch {
          setState("error");
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      map?.remove();
    };
  }, [stops]);

  return (
    <div className="relative mt-4 h-72 overflow-hidden rounded-[var(--radius-card)] border border-line bg-sand sm:h-80">
      <div ref={ref} className="absolute inset-0 z-0" role="img" aria-label={`Map of the route: ${stops.map((s) => s.name).join(", ")}`} />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">{state === "error" ? "The map could not load. The route is listed above." : "Loading map…"}</div>
      )}
    </div>
  );
}
