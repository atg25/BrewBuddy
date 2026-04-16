import { describe, expect, it } from "vitest";
import {
  createSearchAttemptPlan,
  DEFAULT_CHAT_MAX_STEPS,
  ensureVisiblePublicDataWarning,
  getControlledEmptyStateCopy,
  getLoadingCopy,
  getRetryCopy,
  resolveChatMaxSteps,
  shouldRetryForEmptyResults,
  toReadableChatErrorMessage,
} from "@/lib/server/chat/agenticLoop";

describe("agentic loop helpers", () => {
  const toEnv = (env: Record<string, string>) =>
    env as unknown as NodeJS.ProcessEnv;

  it("creates a bounded broader-search attempt plan", () => {
    const plan = createSearchAttemptPlan(
      {
        flavors: ["dark roast", "cocoa"],
        style_category: "stout",
      },
      3,
    );

    expect(plan).toHaveLength(3);
    expect(plan[0]?.style_category).toBe("stout");
    expect(plan[1]?.style_category).toBeUndefined();
    expect(plan[2]?.flavors).toEqual(["dark roast"]);
  });

  it("retries only when results are empty and budget remains", () => {
    expect(
      shouldRetryForEmptyResults(
        { beers: [], source: "winevybe", cache_hit: false, warning: null },
        1,
        3,
      ),
    ).toBe(true);

    expect(
      shouldRetryForEmptyResults(
        {
          beers: [{ id: "u-1" } as never],
          source: "winevybe",
          cache_hit: false,
          warning: null,
        },
        1,
        3,
      ),
    ).toBe(false);

    expect(
      shouldRetryForEmptyResults(
        { beers: [], source: "winevybe", cache_hit: false, warning: null },
        3,
        3,
      ),
    ).toBe(false);

    expect(
      shouldRetryForEmptyResults(
        {
          beers: [],
          source: "winevybe",
          cache_hit: false,
          warning: "Fallback source temporarily unavailable",
        },
        1,
        3,
      ),
    ).toBe(false);
  });

  it("resolves max steps with defaults and clamping", () => {
    expect(resolveChatMaxSteps({} as NodeJS.ProcessEnv)).toBe(
      DEFAULT_CHAT_MAX_STEPS,
    );
    expect(resolveChatMaxSteps(toEnv({ CHAT_MAX_STEPS: "2" }))).toBe(2);
    expect(resolveChatMaxSteps(toEnv({ CHAT_MAX_STEPS: "100" }))).toBe(5);
    expect(resolveChatMaxSteps(toEnv({ CHAT_MAX_STEPS: "invalid" }))).toBe(
      DEFAULT_CHAT_MAX_STEPS,
    );
  });

  it("ensures fallback warning visibility for WineVybe results", () => {
    const normalized = ensureVisiblePublicDataWarning({
      beers: [],
      source: "winevybe",
      cache_hit: false,
      warning: null,
    });

    expect(normalized.warning).toMatch(/WineVybe/i);
  });

  it("keeps loading and retry copy short and readable", () => {
    expect(getLoadingCopy().length).toBeLessThanOrEqual(80);
    expect(getRetryCopy(2, 3).length).toBeLessThanOrEqual(90);
    expect(getControlledEmptyStateCopy(3)).toMatch(/after 3 attempts/i);
  });

  it("maps known failure classes to user-readable text", () => {
    expect(toReadableChatErrorMessage(new Error("request timed out"))).toMatch(
      /timed out/i,
    );
    expect(
      toReadableChatErrorMessage(new Error("temporarily unavailable")),
    ).toMatch(/temporarily unavailable/i);
    expect(toReadableChatErrorMessage(new Error("malformed payload"))).toMatch(
      /data issue/i,
    );
  });
});
