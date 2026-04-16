export function BeerCardSkeleton() {
  return (
    <article
      aria-busy="true"
      aria-label="Loading beer recommendation"
      className="relative overflow-hidden rounded-2xl border border-amber-200/40 bg-[var(--surface)] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.18)]"
      data-testid="beer-card-skeleton"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-soft))]" />
      <div className="flex gap-4">
        <div className="h-20 w-20 animate-pulse rounded-xl bg-amber-200/70" />

        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-amber-200/80" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-amber-100/90" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-stone-200" />
        </div>
      </div>

      <div className="mt-4 h-3 w-full animate-pulse rounded bg-stone-200" />
      <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-stone-200" />
    </article>
  );
}
