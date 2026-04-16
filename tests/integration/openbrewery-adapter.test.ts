import { describe, expect, it } from "vitest";
import { OpenBreweryDbClient } from "@/lib/server/adapters/openBreweryDb";

describe("WineVybe adapter compatibility", () => {
  it("maps master-list entries into normalized beers", async () => {
    const client = new OpenBreweryDbClient({
      baseUrl: "https://beer9.p.rapidapi.com",
      masterListUrl:
        "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
      rapidApiHost: "beer9.p.rapidapi.com",
      rapidApiKey: "test-key",
      fetchImpl: async () =>
        new Response("Fallback Brewing Co Citrus IPA\n", { status: 200 }),
    });

    const result = await client.searchPublic({ flavors: ["chocolate"] });

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("winevybe");
    expect(result[0]?.warning).toMatch(/WineVybe/i);
  });

  it("prioritizes style/flavor matches from the catalog", async () => {
    const client = new OpenBreweryDbClient({
      baseUrl: "https://beer9.p.rapidapi.com",
      masterListUrl:
        "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
      rapidApiHost: "beer9.p.rapidapi.com",
      rapidApiKey: "test-key",
      fetchImpl: async () =>
        new Response(
          [
            "Alpha Brewing Co Clean Lager",
            "Night Owl Brewing Co Dark Roast Stout",
          ].join("\n"),
          { status: 200 },
        ),
    });

    const results = await client.searchPublic({
      flavors: ["dark roast", "cocoa"],
      style_category: "stout",
    });

    expect(results[0]?.style).toContain("stout");
  });

  it("throws readable error when master list fetch fails", async () => {
    const client = new OpenBreweryDbClient({
      baseUrl: "https://beer9.p.rapidapi.com",
      masterListUrl:
        "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
      rapidApiHost: "beer9.p.rapidapi.com",
      rapidApiKey: "test-key",
      fetchImpl: async () => new Response("", { status: 503 }),
    });

    await expect(client.searchPublic({ flavors: ["citrus"] })).rejects.toThrow(
      /master list request failed/i,
    );
  });

  it("throws readable outage error on 5xx response", async () => {
    const client = new OpenBreweryDbClient({
      baseUrl: "https://beer9.p.rapidapi.com",
      masterListUrl:
        "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
      rapidApiHost: "beer9.p.rapidapi.com",
      rapidApiKey: "test-key",
      fetchImpl: async () => new Response(JSON.stringify({}), { status: 503 }),
    });

    await expect(client.searchPublic({ flavors: ["citrus"] })).rejects.toThrow(
      /master list request failed/i,
    );
  });
});
