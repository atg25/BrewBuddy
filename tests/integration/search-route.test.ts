import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/search/route";

let tmpDir: string;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "brewbuddy-route-"));
  process.env.DB_PATH = path.join(tmpDir, "cache.sqlite");
  process.env.WINEVYBE_BASE_URL = "https://beer9.p.rapidapi.com";
  process.env.WINEVYBE_MASTER_LIST_URL =
    "https://winevybe.com/v/beerapi/beers-master-list-2023.txt";
  process.env.RAPIDAPI_HOST = "beer9.p.rapidapi.com";
  process.env.RAPIDAPI_KEY = "test-key";
});

afterEach(() => {
  process.env = originalEnv;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("POST /api/search", () => {
  it("returns 400 for invalid json body", async () => {
    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ flavors: [] }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns normalized public data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("Coffee Public Brew Co Porter\n", { status: 200 }),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ flavors: ["coffee"] }),
      }),
    );

    const body = (await response.json()) as {
      source: string;
      beers: unknown[];
    };
    expect(response.status).toBe(200);
    expect(body.source).toBe("winevybe");
    expect(body.beers.length).toBe(1);
  });

  it("returns safe empty response when public source is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ flavors: ["citrus"] }),
      }),
    );

    const body = (await response.json()) as {
      source: string;
      warning: string | null;
      beers: unknown[];
    };
    expect(response.status).toBe(200);
    expect(body.source).toBe("winevybe");
    expect(body.beers).toHaveLength(0);
    expect(body.warning).toMatch(/temporarily unavailable/i);
  });

  it("returns safe empty response when public source payload is malformed", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("request timed out"));

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ flavors: ["citrus"] }),
      }),
    );

    const body = (await response.json()) as {
      source: string;
      warning: string | null;
      beers: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.source).toBe("winevybe");
    expect(body.beers).toHaveLength(0);
    expect(body.warning).toMatch(/timed out/i);
  });
});
