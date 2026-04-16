import { describe, expect, it } from "vitest";
import { makeSearchCacheKey } from "@/lib/server/cache/key";

describe("makeSearchCacheKey", () => {
  it("is stable for equivalent flavor order", () => {
    const one = makeSearchCacheKey({
      flavors: ["Dark Roast", "Chocolate"],
      style_category: "Stout",
    });
    const two = makeSearchCacheKey({
      flavors: ["chocolate", "dark roast"],
      style_category: "stout",
    });

    expect(one).toBe(two);
  });
});
