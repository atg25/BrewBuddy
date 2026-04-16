import { describe, expect, it } from "vitest";
import {
  getRecommendationGridClass,
  getTranscriptBubbleClass,
} from "@/lib/client/layout";

describe("responsive layout helpers", () => {
  it("uses single-column grid for one card", () => {
    expect(getRecommendationGridClass(1)).toBe("grid grid-cols-1 gap-4");
  });

  it("uses responsive two-column grid for multiple cards", () => {
    expect(getRecommendationGridClass(3)).toBe(
      "grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3",
    );
  });

  it("returns distinct transcript bubble classes by role", () => {
    expect(getTranscriptBubbleClass("user")).toContain("ml-auto");
    expect(getTranscriptBubbleClass("assistant")).toContain("mr-auto");
  });
});
