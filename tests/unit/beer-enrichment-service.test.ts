import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SearchCacheRepository } from "@/lib/server/cache/repository";
import { BeerEnrichmentService } from "@/lib/server/services/beerEnrichmentService";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function createTestCache(): SearchCacheRepository {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brewbuddy-enrichment-"));
  tempDirs.push(dir);
  return new SearchCacheRepository(path.join(dir, "cache.sqlite"));
}

const baseConfig = {
  WINEVYBE_BASE_URL: "https://beer9.p.rapidapi.com",
  WINEVYBE_MASTER_LIST_URL:
    "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
  RAPIDAPI_HOST: "beer9.p.rapidapi.com",
  RAPIDAPI_KEY: "test-key",
  DB_PATH: ".data/test.sqlite",
  SEARCH_TTL_SECONDS: 300,
  DETAILS_TTL_SECONDS: 300,
};

const sampleBeer = {
  id: "u-1",
  name: "Night Porter",
  brewery: "North Brew",
  style: "porter",
  description: "Coffee and cocoa",
  abv: 5.8,
  image_url: null,
  external_url: "https://northbrew.example.com/night-porter",
  source: "winevybe" as const,
  warning: null,
};

describe("BeerEnrichmentService", () => {
  it("falls back to Bing when DuckDuckGo lookup fails", async () => {
    const cache = createTestCache();

    const service = new BeerEnrichmentService({
      cache,
      config: baseConfig,
      fetchImpl: async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes("duckduckgo.com/html")) {
          return new Response("", { status: 503 });
        }

        if (url.includes("bing.com/search")) {
          return new Response(
            `<html><body>
              <li class="b_algo">
                <h2><a href="https://www.untappd.com/b/north-brew-night-porter/123">Night Porter - Untappd</a></h2>
                <p>Rich roasted cocoa and coffee notes with a smooth finish. 5.8% ABV.</p>
              </li>
            </body></html>`,
            { status: 200 },
          );
        }

        return new Response("", { status: 404 });
      },
    });

    const result = await service.enrichBeerWithStatus(sampleBeer);

    expect(result.status).toBe("ok");
    expect(result.enrichment).not.toBeNull();
    expect(result.enrichment?.trusted_links.length).toBeGreaterThan(0);

    cache.close();
  });
});
