import { z } from "zod";

export const beerSourceSchema = z.enum(["winevybe"]);

export const trustedLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
});

export const beerEnrichmentSchema = z.object({
  style_detail: z.string().min(1).nullable(),
  abv_hint: z.string().min(1).nullable(),
  tasting_notes: z.string().min(1).nullable(),
  awards: z.string().min(1).nullable(),
  trusted_links: z.array(trustedLinkSchema).max(3),
  field_confidence: z.object({
    style_detail: z.number().min(0).max(1).nullable(),
    abv_hint: z.number().min(0).max(1).nullable(),
    tasting_notes: z.number().min(0).max(1).nullable(),
    awards: z.number().min(0).max(1).nullable(),
  }),
});

export const beerResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brewery: z.string().min(1),
  style: z.string().min(1),
  description: z.string().min(1),
  abv: z.number().min(0),
  image_url: z.string().url().nullable(),
  external_url: z.string().url().nullable(),
  source: beerSourceSchema,
  warning: z.string().min(1).nullable(),
  enrichment: beerEnrichmentSchema.nullable().optional(),
});

export const searchInputSchema = z.object({
  flavors: z.array(z.string().min(1)).min(1).max(10),
  style_category: z.string().min(1).max(60).optional(),
});

export const searchResponseSchema = z.object({
  beers: z.array(beerResultSchema).max(5),
  source: beerSourceSchema,
  cache_hit: z.boolean(),
  warning: z.string().nullable(),
});

export const beerDetailsSchema = beerResultSchema.extend({
  ibu: z.number().nullable().optional(),
});

export type BeerResult = z.infer<typeof beerResultSchema>;
export type BeerSource = z.infer<typeof beerSourceSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type BeerDetails = z.infer<typeof beerDetailsSchema>;
export type BeerEnrichment = z.infer<typeof beerEnrichmentSchema>;
