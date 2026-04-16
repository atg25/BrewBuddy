import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/server/config";

describe("loadConfig", () => {
  it("loads defaults with empty env", () => {
    const config = loadConfig({});

    expect(config.WINEVYBE_BASE_URL).toBe("https://beer9.p.rapidapi.com");
    expect(config.WINEVYBE_MASTER_LIST_URL).toBe(
      "https://winevybe.com/v/beerapi/beers-master-list-2023.txt",
    );
    expect(config.SEARCH_TTL_SECONDS).toBe(604800);
  });

  it("throws on invalid public provider URL", () => {
    expect(() => loadConfig({ WINEVYBE_BASE_URL: "not-a-url" })).toThrow(
      /Invalid configuration/,
    );
  });
});
