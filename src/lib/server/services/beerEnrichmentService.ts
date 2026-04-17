import { makeBeerEnrichmentCacheKey } from "@/lib/server/cache/key";
import { SearchCacheRepository } from "@/lib/server/cache/repository";
import type { AppConfig } from "@/lib/server/config";
import {
  beerEnrichmentSchema,
  type BeerEnrichment,
  type BeerResult,
} from "@/lib/types/beer";

type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

type WebSearchOutcome = {
  hits: WebSearchHit[];
  failed: boolean;
};

type WebSearchProvider = {
  name: "duckduckgo" | "bing";
  buildUrl: (query: string) => string;
  resultPattern: RegExp;
  extractUrl: (rawUrl: string) => string;
  likelyResultMarker: RegExp;
};

export type BeerEnrichmentStatus = "ok" | "no-data" | "lookup-failed";

export interface BeerEnrichmentResult {
  enrichment: BeerEnrichment | null;
  status: BeerEnrichmentStatus;
}

const TRUSTED_DOMAIN_RANK: Record<string, number> = {
  "untappd.com": 1,
  "beeradvocate.com": 0.97,
  "ratebeer.com": 0.96,
  "brewersassociation.org": 0.95,
  "wikipedia.org": 0.9,
};

const MAX_LINKS = 3;
const WEB_SEARCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const WEB_SEARCH_PROVIDERS: WebSearchProvider[] = [
  {
    name: "duckduckgo",
    buildUrl: (query) =>
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    resultPattern:
      /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi,
    extractUrl: (rawUrl) => {
      const urlParamMatch = rawUrl.match(/uddg=([^&]+)/);
      return urlParamMatch ? decodeURIComponent(urlParamMatch[1]!) : rawUrl;
    },
    likelyResultMarker: /result__a|result__snippet/i,
  },
  {
    name: "bing",
    buildUrl: (query) =>
      `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    resultPattern:
      /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>[\s\S]*?<h2>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:<p[^>]*>(.*?)<\/p>)?/gi,
    extractUrl: (rawUrl) => rawUrl,
    likelyResultMarker: /b_algo|<h2>\s*<a/i,
  },
];

function htmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function domainRank(domain: string, breweryDomain?: string | null): number {
  if (breweryDomain && domain === breweryDomain) {
    return 1;
  }

  if (domain in TRUSTED_DOMAIN_RANK) {
    return TRUSTED_DOMAIN_RANK[domain]!;
  }

  return 0;
}

function getBreweryDomain(beer: BeerResult): string | null {
  if (!beer.external_url) {
    return null;
  }

  return getDomain(beer.external_url);
}

function summarizeSnippetField(
  snippet: string,
  beerName: string,
  brewery: string,
): { mentionBoost: number; normalized: string } {
  const normalized = snippet.trim();
  let mentionBoost = 0;

  if (normalized.toLowerCase().includes(beerName.toLowerCase())) {
    mentionBoost += 0.1;
  }

  if (normalized.toLowerCase().includes(brewery.toLowerCase())) {
    mentionBoost += 0.1;
  }

  return {
    mentionBoost,
    normalized,
  };
}

function normalizeNarrativeSnippet(text: string): string | null {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/^[-:|\s]+/, "")
    .trim();

  if (normalized.length < 45 || normalized.length > 260) {
    return null;
  }

  if (
    /\b(buy|shop|price|shipping|order now|sign in|log in|menu|taproom hours)\b/i.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

function bestByScore(candidates: Array<{ value: string; score: number }>) {
  if (candidates.length === 0) {
    return null;
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0]!;
  return {
    value: best.value,
    score: Number(best.score.toFixed(2)),
  };
}

function extractWebSearchHits(
  html: string,
  provider: WebSearchProvider,
): WebSearchHit[] {
  const hits: WebSearchHit[] = [];
  let match: RegExpExecArray | null = provider.resultPattern.exec(html);

  while (match && hits.length < 12) {
    const rawUrl = htmlDecode(match[1] ?? "");
    const resolvedUrl = provider.extractUrl(rawUrl);
    const domain = getDomain(resolvedUrl);

    if (!domain) {
      match = provider.resultPattern.exec(html);
      continue;
    }

    hits.push({
      title: htmlDecode(match[2] ?? ""),
      url: resolvedUrl,
      snippet: htmlDecode(match[3] ?? ""),
      domain,
    });

    match = provider.resultPattern.exec(html);
  }

  return hits;
}

export class BeerEnrichmentService {
  private readonly cache: SearchCacheRepository;
  private readonly fetchImpl: typeof fetch;
  private readonly config: AppConfig;

  constructor(options: {
    cache: SearchCacheRepository;
    config: AppConfig;
    fetchImpl?: typeof fetch;
  }) {
    this.cache = options.cache;
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async enrichBeer(beer: BeerResult): Promise<BeerEnrichment | null> {
    const result = await this.enrichBeerWithStatus(beer);
    return result.enrichment;
  }

  async enrichBeerWithStatus(beer: BeerResult): Promise<BeerEnrichmentResult> {
    const key = makeBeerEnrichmentCacheKey({
      id: beer.id,
      name: beer.name,
      brewery: beer.brewery,
      style: beer.style,
    });

    const cached = this.cache.getEnrichment(key);
    if (cached) {
      return {
        enrichment: cached.payload,
        status: "ok",
      };
    }

    const webSearchOutcome = await this.searchWeb(
      `${beer.name} ${beer.brewery} beer`,
    );

    if (webSearchOutcome.failed) {
      return {
        enrichment: null,
        status: "lookup-failed",
      };
    }

    if (webSearchOutcome.hits.length === 0) {
      return {
        enrichment: null,
        status: "no-data",
      };
    }

    const enrichment = this.extractEnrichment(beer, webSearchOutcome.hits);
    if (!enrichment) {
      return {
        enrichment: null,
        status: "no-data",
      };
    }

    this.cache.setEnrichment(key, enrichment, this.config.DETAILS_TTL_SECONDS);
    return {
      enrichment,
      status: "ok",
    };
  }

  private async searchWeb(query: string): Promise<WebSearchOutcome> {
    let observedLookupFailure = false;

    for (const provider of WEB_SEARCH_PROVIDERS) {
      let response: Response;

      try {
        response = await this.fetchImpl(provider.buildUrl(query), {
          method: "GET",
          headers: {
            "user-agent": WEB_SEARCH_USER_AGENT,
          },
        });
      } catch {
        observedLookupFailure = true;
        continue;
      }

      if (!response.ok) {
        observedLookupFailure = true;
        continue;
      }

      const html = await response.text();
      const hits = extractWebSearchHits(html, provider);

      if (hits.length > 0) {
        return {
          hits,
          failed: false,
        };
      }

      if (provider.likelyResultMarker.test(html)) {
        observedLookupFailure = true;
      }
    }

    return {
      hits: [],
      failed: observedLookupFailure,
    };
  }

  private extractEnrichment(
    beer: BeerResult,
    hits: WebSearchHit[],
  ): BeerEnrichment | null {
    const breweryDomain = getBreweryDomain(beer);

    const trusted = hits
      .map((hit) => ({
        ...hit,
        rank: domainRank(hit.domain, breweryDomain),
      }))
      .filter((hit) => hit.rank > 0)
      .sort((a, b) => b.rank - a.rank);

    if (trusted.length === 0) {
      return null;
    }

    const styleCandidates: Array<{ value: string; score: number }> = [];
    const abvCandidates: Array<{ value: string; score: number }> = [];
    const tastingCandidates: Array<{ value: string; score: number }> = [];
    const awardCandidates: Array<{ value: string; score: number }> = [];

    for (const hit of trusted) {
      const { normalized, mentionBoost } = summarizeSnippetField(
        hit.snippet,
        beer.name,
        beer.brewery,
      );
      const titleText = hit.title.trim();
      const searchableText = `${titleText} ${normalized}`.trim();

      if (!searchableText) {
        continue;
      }

      const styleMatch = searchableText.match(
        /(hazy ipa|double ipa|west coast ipa|new england ipa|imperial stout|stout|porter|lager|pilsner|sour|wheat ale|ale)/i,
      );
      if (styleMatch?.[1]) {
        styleCandidates.push({
          value: styleMatch[1],
          score: Math.min(1, hit.rank + mentionBoost),
        });
      }

      const abvMatch = searchableText.match(/(\d{1,2}(?:\.\d)?)\s?%\s?ABV/i);
      if (abvMatch?.[1]) {
        abvCandidates.push({
          value: `${abvMatch[1]}% ABV`,
          score: Math.min(1, hit.rank + mentionBoost),
        });
      }

      if (
        /notes of|flavors? of|aroma of|tasting notes?/i.test(searchableText)
      ) {
        tastingCandidates.push({
          value: normalized,
          score: Math.min(1, hit.rank + mentionBoost),
        });
      } else {
        const narrativeSnippet = normalizeNarrativeSnippet(normalized);
        if (narrativeSnippet) {
          tastingCandidates.push({
            value: narrativeSnippet,
            score: Math.max(0, Math.min(1, hit.rank + mentionBoost - 0.12)),
          });
        }
      }

      if (/award|medal|winner|gold medal|silver medal/i.test(searchableText)) {
        awardCandidates.push({
          value: normalized,
          score: Math.min(1, hit.rank + mentionBoost),
        });
      }
    }

    const styleBest = bestByScore(styleCandidates);
    const abvBest = bestByScore(abvCandidates);
    const tastingBest = bestByScore(tastingCandidates);
    const awardsBest = bestByScore(awardCandidates);

    const trustedLinks = trusted.slice(0, MAX_LINKS).map((hit) => ({
      title: hit.title,
      url: hit.url,
      domain: hit.domain,
    }));

    if (
      !styleBest &&
      !abvBest &&
      !tastingBest &&
      !awardsBest &&
      trustedLinks.length === 0
    ) {
      return null;
    }

    return beerEnrichmentSchema.parse({
      style_detail: styleBest?.value ?? null,
      abv_hint: abvBest?.value ?? null,
      tasting_notes: tastingBest?.value ?? null,
      awards: awardsBest?.value ?? null,
      trusted_links: trustedLinks,
      field_confidence: {
        style_detail: styleBest?.score ?? null,
        abv_hint: abvBest?.score ?? null,
        tasting_notes: tastingBest?.score ?? null,
        awards: awardsBest?.score ?? null,
      },
    });
  }
}
