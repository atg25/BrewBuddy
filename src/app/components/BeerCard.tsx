/* eslint-disable @next/next/no-img-element */

import type { BeerCardViewModel } from "@/lib/client/recommendationMapper";

export interface BeerCardProps {
  beer: BeerCardViewModel;
}

export function BeerCard({ beer }: BeerCardProps) {
  return (
    <article
      className="group relative overflow-hidden rounded-2xl border border-amber-200/40 bg-[var(--surface)] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(0,0,0,0.24)]"
      data-testid={`beer-card-${beer.id}`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-soft))]" />
      <div className="flex gap-4">
        {beer.imageUrl ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-amber-200/50 bg-amber-50">
            <img
              src={beer.imageUrl}
              alt={`${beer.name} label`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-lg font-semibold text-stone-900">
            {beer.name}
          </h3>
          <p className="mt-1 truncate text-sm font-medium text-stone-700">
            {beer.brewery}
          </p>
          {beer.abvLabel ? (
            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-stone-500">
              {beer.abvLabel}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-amber-300/45 bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
              {beer.style}
            </span>
            <span className="rounded-full border border-stone-300/60 bg-stone-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-700">
              {beer.sourceLabel}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-stone-800">
        {beer.description}
      </p>

      {beer.styleDetail ? (
        <p className="mt-2 text-xs leading-5 text-stone-700">
          Style detail: {beer.styleDetail}
        </p>
      ) : null}

      {beer.abvHint ? (
        <p className="mt-1 text-xs leading-5 text-stone-700">
          ABV hint: {beer.abvHint}
        </p>
      ) : null}

      {beer.tastingNotes ? (
        <p className="mt-2 text-xs leading-5 text-stone-700">
          Tasting notes: {beer.tastingNotes}
        </p>
      ) : null}

      {beer.awards ? (
        <p className="mt-2 text-xs leading-5 text-stone-700">
          Awards: {beer.awards}
        </p>
      ) : null}

      {beer.warning ? (
        <p className="mt-3 rounded-lg border border-amber-300/40 bg-amber-50 px-2 py-1 text-xs text-amber-900">
          {beer.warning}
        </p>
      ) : null}

      {beer.linkUrl ? (
        <div className="mt-4">
          <a
            href={beer.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-stone-900 underline decoration-stone-400 underline-offset-4 transition hover:text-[var(--accent-deep)] hover:decoration-[var(--accent-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
          >
            View brewery page
          </a>
        </div>
      ) : null}

      {beer.sourceLinks.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {beer.sourceLinks.map((link) => (
            <a
              key={`${beer.id}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-stone-700 underline decoration-stone-300 underline-offset-2 transition hover:text-[var(--accent-deep)]"
            >
              Source: {link.domain}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
