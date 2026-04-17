/* eslint-disable @next/next/no-img-element */

import type { BeerCardViewModel } from "@/lib/client/recommendationMapper";

export interface BeerCardProps {
  beer: BeerCardViewModel;
}

export function BeerCard({ beer }: BeerCardProps) {
  return (
    <article
      className="bb-motion group relative overflow-hidden rounded-[1.45rem] border border-[#cfab7b] bg-[var(--surface)] p-4 text-[#2b1f0f] shadow-[0_18px_34px_rgba(74,43,16,0.16)] hover:-translate-y-1 hover:shadow-[0_24px_40px_rgba(74,43,16,0.24)]"
      data-testid={`beer-card-${beer.id}`}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#b66f24,#e2b170)]" />
      <div className="absolute right-3 bottom-3 h-20 w-20 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.38),transparent_72%)] opacity-70" />

      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#7f4b1a]">
        Tasting Flight Pick
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        {beer.imageUrl ? (
          <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-xl border border-[#d4b085] bg-amber-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] sm:h-20 sm:w-20">
            <img
              src={beer.imageUrl}
              alt={`${beer.name} label`}
              className="bb-motion h-full w-full object-cover group-hover:scale-110"
              loading="lazy"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-xl font-semibold tracking-tight text-[#24170c]">
            {beer.name}
          </h3>
          <p className="mt-1 truncate text-sm font-semibold text-[#5f4325]">
            {beer.brewery}
          </p>
          {beer.abvLabel ? (
            <p className="mt-1 text-[11px] uppercase tracking-[0.26em] text-[#806248]">
              {beer.abvLabel}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#c98f4f] bg-[#f5d9b6] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#65380f]">
              {beer.style}
            </span>
            <span className="rounded-full border border-[#acc8b0] bg-[#e7f1e8] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#335742]">
              {beer.sourceLabel}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#3f2b15]">
        {beer.description}
      </p>

      {beer.styleDetail ? (
        <p className="mt-2 text-xs leading-5 text-[#5f4325]">
          Style detail: {beer.styleDetail}
        </p>
      ) : null}

      {beer.abvHint ? (
        <p className="mt-1 text-xs leading-5 text-[#5f4325]">
          ABV hint: {beer.abvHint}
        </p>
      ) : null}

      {beer.tastingNotes ? (
        <p className="mt-2 text-xs leading-5 text-[#5f4325]">
          Tasting notes: {beer.tastingNotes}
        </p>
      ) : null}

      {beer.awards ? (
        <p className="mt-2 text-xs leading-5 text-[#5f4325]">
          Awards: {beer.awards}
        </p>
      ) : null}

      {beer.warning ? (
        <p className="mt-3 rounded-xl border border-[#d7a86b] bg-[#fff2df] px-2.5 py-1.5 text-xs text-[#6f4316]">
          {beer.warning}
        </p>
      ) : null}

      {beer.linkUrl ? (
        <div className="mt-4">
          <a
            href={beer.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bb-motion inline-flex min-h-11 items-center rounded-full border border-[#835425] bg-[#2b1f0f] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#fff6eb] hover:-translate-y-0.5 hover:bg-[#4a2f17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b1f0f]"
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
              className="bb-motion block text-xs font-medium text-[#5b4126] underline decoration-[#aa8a61] underline-offset-2 hover:text-[var(--accent-deep)]"
            >
              Source: {link.domain}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}
