import {
  beerDetailsSchema,
  beerResultSchema,
  type BeerDetails,
  type BeerResult,
  type SearchInput,
} from "@/lib/types/beer";

interface WineVybeClientOptions {
  baseUrl: string;
  masterListUrl: string;
  rapidApiHost?: string;
  rapidApiKey?: string;
  fetchImpl?: typeof fetch;
}

type CatalogEntry = {
  id: string;
  fullName: string;
  brewery: string;
  name: string;
  style: string;
  searchText: string;
};

const DEFAULT_WARNING =
  "WineVybe master list entry. Detailed tasting metadata may be unavailable for this beer.";

const styleHints = [
  "ipa",
  "imperial ipa",
  "double ipa",
  "pale ale",
  "pilsner",
  "lager",
  "stout",
  "porter",
  "sour",
  "wheat",
  "ale",
  "tripel",
  "dubbel",
  "brown ale",
  "amber ale",
  "blonde ale",
] as const;

const breweryMarkers = new Set([
  "brewing",
  "brewery",
  "company",
  "co",
  "co.",
  "brew",
  "beer",
  "brewpub",
  "brewhouse",
  "brews",
  "aleworks",
  "distilling",
  "distillery",
]);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractStyle(fullName: string): string {
  const normalized = fullName.toLowerCase();

  for (const hint of styleHints) {
    if (normalized.includes(hint)) {
      return hint;
    }
  }

  return "beer";
}

function splitCatalogLine(line: string): CatalogEntry {
  const trimmed = line.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  let breweryEndIndex = -1;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]!.replace(/^[^(]*\(?/, "")
      .replace(/[).,]$/g, "")
      .toLowerCase();
    if (breweryMarkers.has(token)) {
      breweryEndIndex = index;
      break;
    }
  }

  if (breweryEndIndex < 0) {
    if (/^[0-9(]/.test(tokens[0] ?? "")) {
      breweryEndIndex = Math.min(1, tokens.length - 2);
    } else {
      breweryEndIndex = Math.min(1, tokens.length - 2);
    }
  }

  const breweryTokens = tokens.slice(0, Math.max(1, breweryEndIndex + 1));
  const nameTokens = tokens.slice(Math.max(1, breweryEndIndex + 1));

  const brewery = breweryTokens.join(" ").trim() || trimmed;
  const name = nameTokens.join(" ").trim() || trimmed;

  return {
    id: slugify(trimmed),
    fullName: trimmed,
    brewery,
    name,
    style: extractStyle(trimmed),
    searchText: normalizeText(trimmed),
  };
}

function buildQueryTokens(input: SearchInput): string[] {
  return Array.from(
    new Set(
      [
        ...input.flavors,
        input.style_category ?? "",
        ...input.flavors.flatMap((flavor) => flavor.split(/\s+/)),
        ...(input.style_category ? input.style_category.split(/\s+/) : []),
      ]
        .map((token) => token.toLowerCase().trim())
        .filter((token) => token.length > 0),
    ),
  );
}

function scoreEntry(entry: CatalogEntry, queryTokens: string[]): number {
  let score = 0;

  for (const token of queryTokens) {
    if (!token) {
      continue;
    }

    if (entry.searchText.includes(token)) {
      score += token.length >= 5 ? 3 : 2;
    }

    if (entry.name.toLowerCase().includes(token)) {
      score += 2;
    }

    if (entry.brewery.toLowerCase().includes(token)) {
      score += 1;
    }
  }

  if (
    entry.searchText.includes("ipa") &&
    queryTokens.some(
      (token) => token.includes("hop") || token.includes("citrus"),
    )
  ) {
    score += 2;
  }

  return score;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUrlOrNull(value: unknown): string | null {
  const maybe = asNonEmptyString(value);
  if (!maybe) {
    return null;
  }

  try {
    new URL(maybe);
    return maybe;
  } catch {
    return null;
  }
}

export class WineVybeClient {
  private readonly baseUrl: string;
  private readonly masterListUrl: string;
  private readonly rapidApiHost?: string;
  private readonly rapidApiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private catalogPromise: Promise<CatalogEntry[]> | null = null;

  constructor(options: WineVybeClientOptions) {
    this.baseUrl = options.baseUrl;
    this.masterListUrl = options.masterListUrl;
    this.rapidApiHost = options.rapidApiHost;
    this.rapidApiKey = options.rapidApiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async loadCatalog(): Promise<CatalogEntry[]> {
    if (!this.catalogPromise) {
      this.catalogPromise = (async () => {
        let response: Response;

        try {
          response = await this.fetchImpl(this.masterListUrl, {
            method: "GET",
          });
        } catch {
          throw new Error("WineVybe master list request timed out");
        }

        if (!response.ok) {
          throw new Error(
            `WineVybe master list request failed with status ${response.status}`,
          );
        }

        const text = await response.text();
        return Array.from(
          new Set(
            text
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.length > 0),
          ),
        ).map(splitCatalogLine);
      })();
    }

    return this.catalogPromise;
  }

  private toBeerResult(entry: CatalogEntry): BeerResult {
    return beerResultSchema.parse({
      id: entry.id,
      name: entry.name,
      brewery: entry.brewery,
      style: entry.style,
      description: `WineVybe catalog match for ${entry.fullName}.`,
      abv: 0,
      image_url: null,
      external_url: null,
      source: "winevybe",
      warning: DEFAULT_WARNING,
    });
  }

  private async tryDetailsEndpoint(
    identifier: string,
  ): Promise<BeerDetails | null> {
    const candidates = [
      `/beer/${encodeURIComponent(identifier)}`,
      `/beer/name/${encodeURIComponent(identifier)}`,
      `/beerapi/beer/${encodeURIComponent(identifier)}`,
      `/api/beer/${encodeURIComponent(identifier)}`,
    ];

    if (!this.rapidApiKey || !this.rapidApiHost) {
      return null;
    }

    for (const candidate of candidates) {
      let response: Response;

      try {
        response = await this.fetchImpl(`${this.baseUrl}${candidate}`, {
          headers: {
            "X-RapidAPI-Key": this.rapidApiKey,
            "X-RapidAPI-Host": this.rapidApiHost,
          },
        });
      } catch {
        continue;
      }

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const item = Array.isArray(payload) ? payload[0] : payload;

      if (typeof item !== "object" || item === null) {
        continue;
      }

      const candidateBeer = {
        id:
          typeof (item as { sku?: unknown }).sku === "string"
            ? String((item as { sku?: string }).sku)
            : identifier,
        name:
          typeof (item as { name?: unknown }).name === "string"
            ? String((item as { name?: string }).name)
            : identifier,
        brewery:
          typeof (item as { brewery?: unknown }).brewery === "string"
            ? String((item as { brewery?: string }).brewery)
            : identifier,
        style:
          typeof (item as { category?: unknown }).category === "string"
            ? String((item as { category?: string }).category)
            : "beer",
        description:
          typeof (item as { description?: unknown }).description === "string" &&
          String((item as { description?: string }).description).trim().length >
            0
            ? String((item as { description?: string }).description)
            : `WineVybe match for ${identifier}.`,
        abv:
          typeof (item as { abv?: unknown }).abv === "string"
            ? Number.parseFloat(
                String((item as { abv?: string }).abv).replace(/%/g, ""),
              ) || 0
            : typeof (item as { abv?: unknown }).abv === "number"
              ? Number((item as { abv?: number }).abv)
              : 0,
        ibu:
          typeof (item as { ibu?: unknown }).ibu === "string"
            ? Number.parseFloat(String((item as { ibu?: string }).ibu)) || null
            : typeof (item as { ibu?: unknown }).ibu === "number"
              ? Number((item as { ibu?: number }).ibu)
              : null,
        image_url: null,
        external_url: null,
        source: "winevybe",
        warning: null,
      };

      return beerDetailsSchema.parse(candidateBeer);
    }

    return null;
  }

  async searchPublic(input: SearchInput): Promise<BeerResult[]> {
    const catalog = await this.loadCatalog();
    const queryTokens = buildQueryTokens(input);

    const ranked = catalog
      .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map(({ entry }) => this.toBeerResult(entry));

    if (ranked.length > 0) {
      return ranked;
    }

    return catalog.slice(0, 5).map((entry) => this.toBeerResult(entry));
  }

  async getBeerDetails(rawId: string): Promise<BeerDetails> {
    const catalog = await this.loadCatalog();
    const normalized = rawId.trim().toLowerCase();

    const catalogBeer = catalog.find(
      (entry) =>
        entry.id === normalized ||
        entry.fullName.toLowerCase() === normalized ||
        slugify(entry.fullName) === normalized,
    );

    if (catalogBeer) {
      const apiBeer = await this.tryDetailsEndpoint(catalogBeer.fullName);
      if (apiBeer) {
        return apiBeer;
      }

      return beerDetailsSchema.parse({
        ...this.toBeerResult(catalogBeer),
        ibu: null,
      });
    }

    const apiBeer = await this.tryDetailsEndpoint(rawId);
    if (apiBeer) {
      return apiBeer;
    }

    throw new Error("WineVybe beer record not found");
  }
}
