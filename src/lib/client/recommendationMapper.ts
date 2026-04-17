import { z } from "zod";
import { beerResultSchema, beerSourceSchema } from "@/lib/types/beer";

const recommendationEnvelopeSchema = z.object({
  beers: z.array(z.unknown()),
  source: beerSourceSchema,
  cache_hit: z.boolean(),
  warning: z.string().nullable(),
});

export interface BeerCardViewModel {
  id: string;
  name: string;
  brewery: string;
  style: string;
  styleDetail: string | null;
  description: string;
  tastingNotes: string | null;
  awards: string | null;
  abvHint: string | null;
  abvLabel: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  sourceLinks: Array<{ title: string; url: string; domain: string }>;
  warning: string | null;
  sourceLabel: string;
}

export type RecommendationMapResult =
  | {
      kind: "ok";
      cards: BeerCardViewModel[];
      warning: string | null;
      source: z.infer<typeof beerSourceSchema>;
      droppedCount: number;
    }
  | {
      kind: "malformed";
    };

function formatAbv(abv: number): string | null {
  if (!Number.isFinite(abv) || abv <= 0) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

function normalizeCardWarning(warning: string | null): string | null {
  if (!warning) {
    return null;
  }

  if (/not available|unavailable|not found|missing/i.test(warning)) {
    return null;
  }

  return warning;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (
    /not available|unavailable|not found|missing|n\/a|unknown/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeEnvelopeWarning(warning: string | null): string | null {
  if (!warning) {
    return null;
  }

  const withoutBaselineWarning = warning
    .replace(
      /detailed tasting notes unavailable in (the )?winevybe master list\.?/i,
      "",
    )
    .trim();

  if (withoutBaselineWarning.length === 0) {
    return null;
  }

  return withoutBaselineWarning;
}

function sourceLabel(source: z.infer<typeof beerSourceSchema>): string {
  if (source === "winevybe") {
    return "WineVybe";
  }

  return "Beer Catalog";
}

export function mapRecommendationsToBeerCards(
  payload: unknown,
): RecommendationMapResult {
  const envelope = recommendationEnvelopeSchema.safeParse(payload);

  if (!envelope.success) {
    return {
      kind: "malformed",
    };
  }

  const cards: BeerCardViewModel[] = [];
  let droppedCount = 0;

  for (const beerCandidate of envelope.data.beers) {
    const parsedBeer = beerResultSchema.safeParse(beerCandidate);

    if (!parsedBeer.success) {
      droppedCount += 1;
      continue;
    }

    const styleDetail = normalizeOptionalText(
      parsedBeer.data.enrichment?.style_detail,
    );
    const tastingNotes = normalizeOptionalText(
      parsedBeer.data.enrichment?.tasting_notes,
    );
    const awards = normalizeOptionalText(parsedBeer.data.enrichment?.awards);
    const abvHint = normalizeOptionalText(parsedBeer.data.enrichment?.abv_hint);
    const abvLabel = formatAbv(parsedBeer.data.abv);

    const description = parsedBeer.data.description;

    cards.push({
      id: parsedBeer.data.id,
      name: parsedBeer.data.name,
      brewery: parsedBeer.data.brewery,
      style: parsedBeer.data.style,
      styleDetail,
      description,
      tastingNotes,
      awards,
      abvHint,
      abvLabel,
      imageUrl: parsedBeer.data.image_url,
      linkUrl: parsedBeer.data.external_url,
      sourceLinks: parsedBeer.data.enrichment?.trusted_links ?? [],
      warning: normalizeCardWarning(parsedBeer.data.warning),
      sourceLabel: sourceLabel(parsedBeer.data.source),
    });
  }

  return {
    kind: "ok",
    cards,
    warning: normalizeEnvelopeWarning(envelope.data.warning),
    source: envelope.data.source,
    droppedCount,
  };
}
