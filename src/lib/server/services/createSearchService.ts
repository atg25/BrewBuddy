import { SearchCacheRepository } from "@/lib/server/cache/repository";
import { loadConfig } from "@/lib/server/config";
import { WineVybeClient } from "@/lib/server/adapters/wineVybe";
import { BeerEnrichmentService } from "@/lib/server/services/beerEnrichmentService";
import { SearchService } from "@/lib/server/services/searchService";

export interface SearchServiceContext {
  cache: SearchCacheRepository;
  service: SearchService;
  enricher: BeerEnrichmentService;
}

export function createSearchServiceContext(): SearchServiceContext {
  const config = loadConfig();
  const cache = new SearchCacheRepository(config.DB_PATH);

  const service = new SearchService({
    config,
    cache,
    publicData: new WineVybeClient({
      baseUrl: config.WINEVYBE_BASE_URL,
      masterListUrl: config.WINEVYBE_MASTER_LIST_URL,
      rapidApiHost: config.RAPIDAPI_HOST,
      rapidApiKey: config.RAPIDAPI_KEY,
    }),
  });

  const enricher = new BeerEnrichmentService({
    config,
    cache,
  });

  return {
    cache,
    service,
    enricher,
  };
}
