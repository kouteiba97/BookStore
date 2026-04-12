export default function BookCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="aspect-[4/5] w-full animate-pulse bg-muted/60" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-muted/70" />
        <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted/50" />
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="h-2.5 w-12 animate-pulse rounded-full bg-muted/40" />
          <div className="h-4 w-12 animate-pulse rounded-full bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

export function BookGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}
