import type { SearchInput } from "@/lib/types/beer";

export function makeSearchCacheKey(input: SearchInput): string {
  const normalizedFlavors = [...input.flavors]
    .map((f) => f.trim().toLowerCase())
    .sort()
    .join("|");
  const style = input.style_category?.trim().toLowerCase() ?? "any";

  return `search:${normalizedFlavors}:style:${style}`;
}

function normalizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeBeerEnrichmentCacheKey(identity: {
  id: string;
  name: string;
  brewery: string;
  style: string;
}): string {
  return [
    "enrichment",
    normalizeSegment(identity.id),
    normalizeSegment(identity.name),
    normalizeSegment(identity.brewery),
    normalizeSegment(identity.style),
  ].join(":");
}
