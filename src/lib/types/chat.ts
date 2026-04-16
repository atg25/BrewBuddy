import type { UIMessage } from "ai";
import { z } from "zod";
import type { SearchInput, SearchResponse } from "@/lib/types/beer";
import { searchResponseSchema } from "@/lib/types/beer";

export const brewBuddyBeerSearchToolName = "search_beers_by_flavor" as const;
export const brewBuddyBeerSearchToolPartType =
  `tool-${brewBuddyBeerSearchToolName}` as const;

export const chatLoadingPartSchema = z.object({
  state: z.enum(["pending", "done"]),
});

export const chatRetryPartSchema = z.object({
  attempt: z.number().int().positive(),
  max_steps: z.number().int().positive(),
  message: z.string().min(1),
});

export const chatEmptyPartSchema = z.object({
  message: z.string().min(1),
});

export const chatErrorPartSchema = z.object({
  message: z.string().min(1),
});

export const chatRecommendationsPartSchema = searchResponseSchema;

export const chatDataPartSchemas = {
  loading: chatLoadingPartSchema,
  retry: chatRetryPartSchema,
  recommendations: chatRecommendationsPartSchema,
  empty: chatEmptyPartSchema,
  error: chatErrorPartSchema,
};

export type ChatLoadingPart = z.infer<typeof chatLoadingPartSchema>;
export type ChatRetryPart = z.infer<typeof chatRetryPartSchema>;
export type ChatEmptyPart = z.infer<typeof chatEmptyPartSchema>;
export type ChatErrorPart = z.infer<typeof chatErrorPartSchema>;
export type ChatRecommendationsPart = z.infer<
  typeof chatRecommendationsPartSchema
>;

export type BrewBuddyBeerSearchTool = {
  input: SearchInput;
  output: SearchResponse;
};

export type BrewBuddyUIDataParts = {
  loading: ChatLoadingPart;
  retry: ChatRetryPart;
  recommendations: ChatRecommendationsPart;
  empty: ChatEmptyPart;
  error: ChatErrorPart;
};

export type BrewBuddyUITools = {
  [NAME in typeof brewBuddyBeerSearchToolName]: BrewBuddyBeerSearchTool;
};

export type BrewBuddyUIMessage = UIMessage<
  never,
  BrewBuddyUIDataParts,
  BrewBuddyUITools
>;
