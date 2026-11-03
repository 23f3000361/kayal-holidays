import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-56" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );
}
