import {
  searchInputSchema,
  searchResponseSchema,
  type SearchInput,
  type SearchResponse,
} from "@/lib/types/beer";
import { makeSearchCacheKey } from "@/lib/server/cache/key";
import { SearchCacheRepository } from "@/lib/server/cache/repository";
import { WineVybeClient } from "@/lib/server/adapters/wineVybe";
import type { AppConfig } from "@/lib/server/config";

const PUBLIC_DATA_WARNING =
  "Detailed tasting notes unavailable in WineVybe master list";

export interface SearchServiceDeps {
  cache: SearchCacheRepository;
  publicData: WineVybeClient;
  config: AppConfig;
}

export class SearchService {
  private readonly cache: SearchCacheRepository;
  private readonly publicData: WineVybeClient;
  private readonly config: AppConfig;

  constructor(deps: SearchServiceDeps) {
    this.cache = deps.cache;
    this.publicData = deps.publicData;
    this.config = deps.config;
  }

  async search(rawInput: unknown): Promise<SearchResponse> {
    const input = searchInputSchema.parse(rawInput);
    const key = makeSearchCacheKey(input);
    const cached = this.cache.get(key);

    if (cached) {
      return searchResponseSchema.parse({
        ...cached.payload,
        cache_hit: true,
      });
    }

    try {
      const publicResults = await this.publicData.searchPublic(input);
      const normalized = this.buildResponse(
        input,
        publicResults,
        "winevybe",
        false,
        publicResults.length > 0 ? PUBLIC_DATA_WARNING : null,
      );
      this.cache.set(
        key,
        normalized,
        "winevybe",
        this.config.SEARCH_TTL_SECONDS,
      );
      return normalized;
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message.toLowerCase() : "";

      const warning = rawMessage.includes("malformed")
        ? "Public brewery source returned malformed payload"
        : rawMessage.includes("timed out")
          ? "WineVybe source request timed out"
          : "WineVybe source temporarily unavailable";

      return this.buildResponse(input, [], "winevybe", false, warning);
    }
  }

  private buildResponse(
    _input: SearchInput,
    beers: SearchResponse["beers"],
    source: SearchResponse["source"],
    cacheHit: boolean,
    warning: string | null,
  ): SearchResponse {
    return searchResponseSchema.parse({
      beers: beers.slice(0, 5),
      source,
      cache_hit: cacheHit,
      warning,
    });
  }
}
