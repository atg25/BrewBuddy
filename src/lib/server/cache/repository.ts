import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  beerEnrichmentSchema,
  searchResponseSchema,
  type BeerEnrichment,
  type BeerSource,
  type SearchResponse,
} from "@/lib/types/beer";

export interface CacheEntry {
  key: string;
  payload: SearchResponse;
  source: BeerSource;
  expiresAt: number;
}

export interface EnrichmentCacheEntry {
  key: string;
  payload: BeerEnrichment;
  expiresAt: number;
}

export class SearchCacheRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    const resolvedPath = path.resolve(dbPath);
    const dir = path.dirname(resolvedPath);
    fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(resolvedPath);
    this.db.pragma("journal_mode = WAL");
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_cache (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        source TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enrichment_cache (
        key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  get(
    key: string,
    nowEpochSeconds: number = Math.floor(Date.now() / 1000),
  ): CacheEntry | null {
    const row = this.db
      .prepare(
        `SELECT key, payload, source, expires_at
         FROM search_cache
         WHERE key = ?`,
      )
      .get(key) as
      | {
          key: string;
          payload: string;
          source: BeerSource;
          expires_at: number;
        }
      | undefined;

    if (!row) return null;

    if (row.expires_at <= nowEpochSeconds) {
      this.delete(key);
      return null;
    }

    try {
      const parsedPayload = searchResponseSchema.safeParse(
        JSON.parse(row.payload),
      );

      if (!parsedPayload.success) {
        this.delete(key);
        return null;
      }

      return {
        key: row.key,
        payload: parsedPayload.data,
        source: row.source,
        expiresAt: row.expires_at,
      };
    } catch {
      this.delete(key);
      return null;
    }
  }

  set(
    key: string,
    payload: SearchResponse,
    source: BeerSource,
    ttlSeconds: number,
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ttlSeconds;

    this.db
      .prepare(
        `INSERT INTO search_cache (key, payload, source, expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key)
         DO UPDATE SET
           payload = excluded.payload,
           source = excluded.source,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(payload), source, expiresAt, now);
  }

  delete(key: string): void {
    this.db.prepare(`DELETE FROM search_cache WHERE key = ?`).run(key);
  }

  close(): void {
    this.db.close();
  }

  getEnrichment(
    key: string,
    nowEpochSeconds: number = Math.floor(Date.now() / 1000),
  ): EnrichmentCacheEntry | null {
    const row = this.db
      .prepare(
        `SELECT key, payload, expires_at
         FROM enrichment_cache
         WHERE key = ?`,
      )
      .get(key) as
      | {
          key: string;
          payload: string;
          expires_at: number;
        }
      | undefined;

    if (!row) return null;

    if (row.expires_at <= nowEpochSeconds) {
      this.deleteEnrichment(key);
      return null;
    }

    try {
      const parsedPayload = beerEnrichmentSchema.safeParse(
        JSON.parse(row.payload),
      );

      if (!parsedPayload.success) {
        this.deleteEnrichment(key);
        return null;
      }

      return {
        key: row.key,
        payload: parsedPayload.data,
        expiresAt: row.expires_at,
      };
    } catch {
      this.deleteEnrichment(key);
      return null;
    }
  }

  setEnrichment(
    key: string,
    payload: BeerEnrichment,
    ttlSeconds: number,
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ttlSeconds;

    this.db
      .prepare(
        `INSERT INTO enrichment_cache (key, payload, expires_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key)
         DO UPDATE SET
           payload = excluded.payload,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(payload), expiresAt, now);
  }

  deleteEnrichment(key: string): void {
    this.db.prepare(`DELETE FROM enrichment_cache WHERE key = ?`).run(key);
  }
}
