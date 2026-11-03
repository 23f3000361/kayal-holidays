import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    </div>
  );
}
