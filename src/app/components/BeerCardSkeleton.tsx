export function BeerCardSkeleton() {
  return (
    <article
      aria-busy="true"
      aria-label="Loading beer recommendation"
      className="bb-shimmer relative overflow-hidden rounded-[1.45rem] border border-[#cfab7b] bg-[var(--surface)] p-4 shadow-[0_18px_34px_rgba(74,43,16,0.16)]"
      data-testid="beer-card-skeleton"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#b66f24,#e2b170)]" />
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#7f4b1a]">
        Pour in progress
      </p>

      <div className="flex gap-4">
        <div className="bb-breathe h-20 w-20 rounded-xl border border-[#d4b085] bg-[#edd3ad]" />

        <div className="flex-1 space-y-2">
          <div className="bb-breathe h-4 w-2/3 rounded bg-[#e8c79d]" />
          <div className="bb-breathe h-4 w-1/2 rounded bg-[#f0dbbc]" />
          <div className="bb-breathe h-3 w-1/3 rounded bg-[#ddd0bd]" />
        </div>
      </div>

      <div className="bb-breathe mt-4 h-3 w-full rounded bg-[#ddd0bd]" />
      <div className="bb-breathe mt-2 h-3 w-5/6 rounded bg-[#ddd0bd]" />
    </article>
  );
}
