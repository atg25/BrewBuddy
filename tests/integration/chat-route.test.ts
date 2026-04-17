import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";

type StreamChunk = {
  type?: string;
  data?: {
    state?: string;
    message?: string;
    warning?: string | null;
    source?: string;
    attempt?: number;
    max_steps?: number;
    beers?: unknown[];
  };
};

let tmpDir: string;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brewbuddy-chat-route-"));

  process.env.DB_PATH = path.join(tmpDir, "chat-cache.sqlite");
  process.env.WINEVYBE_BASE_URL = "https://beer9.p.rapidapi.com";
  process.env.WINEVYBE_MASTER_LIST_URL =
    "https://winevybe.com/v/beerapi/beers-master-list-2023.txt";
  process.env.RAPIDAPI_HOST = "beer9.p.rapidapi.com";
  process.env.RAPIDAPI_KEY = "test-key";
  process.env.CHAT_MAX_STEPS = "3";
  process.env.AI_GATEWAY_API_KEY = "";
});

afterEach(() => {
  process.env = originalEnv;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function parseSseResponse(raw: string): StreamChunk[] {
  const dataPayloads = raw
    .split("\n\n")
    .map((frame) => frame.trim())
    .filter((frame) => frame.startsWith("data:"))
    .map((frame) => frame.replace(/^data:\s*/, ""))
    .filter((payload) => payload !== "[DONE]");

  return dataPayloads.map((payload) => JSON.parse(payload) as StreamChunk);
}

function createChatRequestBody(prompt: string) {
  return {
    messages: [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: prompt }],
      },
    ],
  };
}

describe("POST /api/chat", () => {
  it("returns recommendations from catalog-backed search", async () => {
    const fetchedUrls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | globalThis.Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        fetchedUrls.push(url);

        return new Response(
          [
            "Pine Trail Brewing Co West Coast IPA",
            "Citrus Field Brewing Co Pale Ale",
          ].join("\n"),
          { status: 200 },
        );
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("citrus and pine")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const recommendationsChunk = chunks.find(
      (chunk) => chunk.type === "data-recommendations",
    );

    expect(response.status).toBe(200);
    expect(fetchedUrls[0]).toContain("beers-master-list-2023.txt");
    expect(recommendationsChunk).toBeDefined();
  });

  it("keeps recommendations but adds warning when enrichment lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | globalThis.Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url.includes("beers-master-list-2023.txt")) {
          return new Response("Pine Trail Brewing Co West Coast IPA", {
            status: 200,
          });
        }

        if (url.includes("duckduckgo.com/html")) {
          return new Response("", { status: 503 });
        }

        return new Response("", { status: 404 });
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("citrus and pine")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const recommendationsChunk = chunks.find(
      (chunk) => chunk.type === "data-recommendations",
    );

    expect(response.status).toBe(200);
    expect(recommendationsChunk?.data?.beers?.length).toBeGreaterThan(0);
    expect(recommendationsChunk?.data?.warning).toMatch(
      /extra tasting detail/i,
    );
  });

  it("surfaces safe provider error when master list lookup fails", async () => {
    process.env.CHAT_MAX_STEPS = "2";

    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("ultra niche profile ipa")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const retryChunks = chunks.filter((chunk) => chunk.type === "data-retry");
    const errorChunk = chunks.find((chunk) => chunk.type === "data-error");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(retryChunks).toHaveLength(0);
    expect(errorChunk?.data?.message).toMatch(/temporarily unavailable/i);
  });

  it("handles timeout as a safe chat error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("request timed out")),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("coffee stout")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const errorChunk = chunks.find((chunk) => chunk.type === "data-error");

    expect(response.status).toBe(200);
    expect(errorChunk?.data?.message).toMatch(/timed out/i);
  });

  it("handles upstream outage as a safe chat error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })),
    );

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("dark roast porter")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const retryChunks = chunks.filter((chunk) => chunk.type === "data-retry");
    const errorChunk = chunks.find((chunk) => chunk.type === "data-error");

    expect(response.status).toBe(200);
    expect(retryChunks).toHaveLength(0);
    expect(errorChunk?.data?.message).toMatch(/temporarily unavailable/i);
  });

  it("maps timeout from catalog fetch into readable chat error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("request timed out"));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("citrus ipa")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const errorChunk = chunks.find((chunk) => chunk.type === "data-error");

    expect(response.status).toBe(200);
    expect(errorChunk).toBeDefined();
    expect(errorChunk?.data?.message).toMatch(/timed out/i);
  });

  it("does not infer ale style from substring matches like whale", async () => {
    const fetchMock = vi.fn(
      async () => new Response("Whale Song Brewing Co IPA\n", { status: 200 }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(
          createChatRequestBody("whale crackers and citrus"),
        ),
      }),
    );

    expect(fetchMock).toHaveBeenCalled();
  });

  it("streams readable error data when search context initialization fails", async () => {
    process.env.WINEVYBE_BASE_URL = "not-a-url";

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify(createChatRequestBody("citrus IPA")),
      }),
    );

    const chunks = parseSseResponse(await response.text());
    const loadingDoneChunk = chunks.find(
      (chunk) => chunk.type === "data-loading" && chunk.data?.state === "done",
    );
    const errorChunk = chunks.find((chunk) => chunk.type === "data-error");

    expect(response.status).toBe(200);
    expect(loadingDoneChunk).toBeDefined();
    expect(errorChunk).toBeDefined();
    expect(errorChunk?.data?.message).toMatch(/temporarily unavailable/i);
  });

  it("returns 400 for invalid JSON request body", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
  });
});
