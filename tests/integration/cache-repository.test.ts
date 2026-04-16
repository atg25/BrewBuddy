import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { SearchCacheRepository } from "@/lib/server/cache/repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function createRepository() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brewbuddy-cache-"));
  tempDirs.push(dir);
  const dbPath = path.join(dir, "cache.sqlite");
  return {
    repo: new SearchCacheRepository(dbPath),
    dbPath,
  };
}

describe("SearchCacheRepository", () => {
  it("writes and reads a valid payload", () => {
    const { repo } = createRepository();

    repo.set(
      "k1",
      {
        beers: [],
        source: "winevybe",
        cache_hit: false,
        warning: null,
      },
      "winevybe",
      120,
    );

    const value = repo.get("k1");
    repo.close();

    expect(value).not.toBeNull();
    expect(value?.payload.source).toBe("winevybe");
  });

  it("returns null and deletes expired rows", () => {
    const { repo } = createRepository();

    repo.set(
      "expired",
      {
        beers: [],
        source: "winevybe",
        cache_hit: false,
        warning: null,
      },
      "winevybe",
      -1,
    );

    const result = repo.get("expired");
    repo.close();

    expect(result).toBeNull();
  });

  it("purges rows with malformed json payload", () => {
    const { repo, dbPath } = createRepository();

    repo.set(
      "bad-json",
      {
        beers: [],
        source: "winevybe",
        cache_hit: false,
        warning: null,
      },
      "winevybe",
      120,
    );

    const db = new Database(dbPath);
    db.prepare("UPDATE search_cache SET payload = ? WHERE key = ?").run(
      "{bad-json}",
      "bad-json",
    );
    db.close();

    const value = repo.get("bad-json");
    repo.close();

    expect(value).toBeNull();
  });

  it("purges rows with invalid structured payload", () => {
    const { repo, dbPath } = createRepository();

    repo.set(
      "bad-structure",
      {
        beers: [],
        source: "winevybe",
        cache_hit: false,
        warning: null,
      },
      "winevybe",
      120,
    );

    const db = new Database(dbPath);
    db.prepare("UPDATE search_cache SET payload = ? WHERE key = ?").run(
      JSON.stringify({
        source: "openbrewerydb",
        cache_hit: false,
        warning: null,
      }),
      "bad-structure",
    );
    db.close();

    const value = repo.get("bad-structure");
    repo.close();

    expect(value).toBeNull();
  });
});
