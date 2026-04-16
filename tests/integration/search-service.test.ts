import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchCacheRepository } from "@/lib/server/cache/repository";
import { WineVybeClient } from "@/lib/server/adapters/wineVybe";
import { SearchService } from "@/lib/server/services/searchService";
import type { BeerResult } from "@/lib/types/beer";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function makeService(overrides?: {
  publicSearch?: () => Promise<BeerResult[]>;
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brewbuddy-service-"));
  tempDirs.push(dir);

  const cache = new SearchCacheRepository(path.join(dir, "cache.sqlite"));

  const publicData = {
    searchPublic: overrides?.publicSearch ?? (async () => []),
  } as unknown as WineVybeClient;

  return {
    cache,
    service: new SearchService({
      cache,
      publicData,
      config: {
        WINEVYBE_BASE_URL: "https://beer9.p.rapidapi.com",
        WINEVYBE_MASTER_LIST_URL:
          "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
        RAPIDAPI_HOST: "beer9.p.rapidapi.com",
        RAPIDAPI_KEY: "test-key",
        DB_PATH: ".data/test.sqlite",
        SEARCH_TTL_SECONDS: 100,
        DETAILS_TTL_SECONDS: 100,
      },
    }),
  };
}

const sampleBeer = {
  id: "1",
  name: "Midnight Stout",
  brewery: "Brew Co",
  style: "stout",
  description: "Chocolate and roast",
  abv: 6.8,
  image_url: null,
  external_url: null,
  source: "winevybe" as const,
  warning: "Detailed tasting notes unavailable in WineVybe master list",
};

describe("SearchService", () => {
  it("returns cached result when present", async () => {
    const { service, cache } = makeService();

    cache.set(
      "search:coffee:style:any",
      {
        beers: [sampleBeer],
        source: "winevybe",
        cache_hit: false,
        warning: "Detailed tasting notes unavailable in WineVybe master list",
      },
      "winevybe",
      100,
    );

    const result = await service.search({ flavors: ["coffee"] });
    cache.close();

    expect(result.cache_hit).toBe(true);
    expect(result.beers.length).toBe(1);
  });

  it("returns normalized public data on successful lookup", async () => {
    const { service, cache } = makeService({
      publicSearch: async () => [sampleBeer],
    });

    const result = await service.search({ flavors: ["coffee"] });
    cache.close();

    expect(result.source).toBe("winevybe");
    expect(result.warning).toMatch(/WineVybe/i);
  });

  it("returns safe empty response when public source is unavailable", async () => {
    const { service, cache } = makeService({
      publicSearch: async () => {
        throw new Error(
          "Public brewery source temporarily unavailable with status 503",
        );
      },
    });

    const result = await service.search({ flavors: ["coffee"] });
    cache.close();

    expect(result.source).toBe("winevybe");
    expect(result.beers).toHaveLength(0);
    expect(result.warning).toMatch(/temporarily unavailable/i);
  });

  it("returns safe empty response when public source payload is malformed", async () => {
    const { service, cache } = makeService({
      publicSearch: async () => {
        throw new Error("Public brewery source returned malformed payload");
      },
    });

    const result = await service.search({ flavors: ["coffee"] });
    cache.close();

    expect(result.source).toBe("winevybe");
    expect(result.beers).toHaveLength(0);
    expect(result.warning).toMatch(/malformed/i);
  });

  it("rejects invalid input before making calls", async () => {
    const publicSpy = vi.fn(async () => []);

    const { service, cache } = makeService({
      publicSearch: publicSpy,
    });

    await expect(service.search({ flavors: [] })).rejects.toThrow();
    cache.close();

    expect(publicSpy).not.toHaveBeenCalled();
  });
});
