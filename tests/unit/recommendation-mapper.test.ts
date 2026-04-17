import { describe, expect, it } from "vitest";
import { mapRecommendationsToBeerCards } from "@/lib/client/recommendationMapper";

describe("mapRecommendationsToBeerCards", () => {
  it("maps valid normalized payload into card models", () => {
    const result = mapRecommendationsToBeerCards({
      beers: [
        {
          id: "u-1",
          name: "Night Porter",
          brewery: "North Brew",
          style: "porter",
          description: "Coffee and cocoa",
          abv: 5.8,
          image_url: "https://example.com/porter.png",
          external_url: "https://example.com/beer/u-1",
          source: "winevybe",
          warning: null,
          extra_field: "ignored",
        },
      ],
      source: "winevybe",
      cache_hit: false,
      warning: null,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.abvLabel).toBe("5.8% ABV");
    expect(result.droppedCount).toBe(0);
  });

  it("returns malformed for invalid envelope payload", () => {
    const result = mapRecommendationsToBeerCards({ invalid: true });
    expect(result.kind).toBe("malformed");
  });

  it("drops malformed cards while preserving valid cards", () => {
    const result = mapRecommendationsToBeerCards({
      beers: [
        {
          id: "u-1",
          name: "Night Porter",
          brewery: "North Brew",
          style: "porter",
          description: "Coffee and cocoa",
          abv: 5.8,
          image_url: null,
          external_url: null,
          source: "winevybe",
          warning: null,
        },
        {
          id: "bad-card",
          name: "Broken",
          brewery: "Unknown",
          style: "unknown",
          description: "bad",
          abv: -1,
          image_url: null,
          external_url: null,
          source: "winevybe",
          warning: null,
        },
      ],
      source: "winevybe",
      cache_hit: false,
      warning: null,
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.id).toBe("u-1");
    expect(result.droppedCount).toBe(1);
  });

  it("keeps additional warning text after removing baseline WineVybe warning", () => {
    const result = mapRecommendationsToBeerCards({
      beers: [
        {
          id: "u-1",
          name: "Night Porter",
          brewery: "North Brew",
          style: "porter",
          description: "Coffee and cocoa",
          abv: 5.8,
          image_url: null,
          external_url: null,
          source: "winevybe",
          warning: null,
        },
      ],
      source: "winevybe",
      cache_hit: false,
      warning:
        "Detailed tasting notes unavailable in the WineVybe master list. Could not load extra tasting detail from web sources right now.",
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }

    expect(result.warning).toBe(
      "Could not load extra tasting detail from web sources right now.",
    );
  });
});
