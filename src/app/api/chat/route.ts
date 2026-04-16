import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  gateway,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createSearchServiceContext } from "@/lib/server/services/createSearchService";
import {
  createSearchAttemptPlan,
  ensureVisiblePublicDataWarning,
  getControlledEmptyStateCopy,
  getLoadingCopy,
  getRetryCopy,
  resolveChatMaxSteps,
  shouldRetryForEmptyResults,
  toReadableChatErrorMessage,
} from "@/lib/server/chat/agenticLoop";
import {
  brewBuddyBeerSearchToolName,
  type BrewBuddyUIMessage,
} from "@/lib/types/chat";
import {
  searchInputSchema,
  type BeerResult,
  type SearchResponse,
} from "@/lib/types/beer";
import { BeerEnrichmentService } from "@/lib/server/services/beerEnrichmentService";

export const dynamic = "force-dynamic";

type ChatRequestPart = {
  type: string;
  text?: unknown;
};

type ChatRequestMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: ChatRequestPart[];
};

const styleKeywords = [
  "ipa",
  "stout",
  "porter",
  "lager",
  "pilsner",
  "sour",
  "wheat",
  "ale",
];

function extractStyleCategory(prompt: string): string | undefined {
  for (const styleKeyword of styleKeywords) {
    const stylePattern = new RegExp(`\\b${styleKeyword}\\b`, "i");
    if (stylePattern.test(prompt)) {
      return styleKeyword;
    }
  }

  return undefined;
}

function isChatRequestPart(value: unknown): value is ChatRequestPart {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function isChatRequestMessage(value: unknown): value is ChatRequestMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    id?: unknown;
    role?: unknown;
    parts?: unknown;
  };

  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" ||
      candidate.role === "assistant" ||
      candidate.role === "system") &&
    Array.isArray(candidate.parts) &&
    candidate.parts.every(isChatRequestPart)
  );
}

function extractLatestUserPrompt(
  messages: ChatRequestMessage[],
): string | null {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return null;
  }

  const prompt = latestUserMessage.parts
    .flatMap((part) => {
      if (part.type !== "text" || typeof part.text !== "string") {
        return [];
      }

      return [part.text.trim()];
    })
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();

  return prompt.length > 0 ? prompt : null;
}

function toSearchInput(prompt: string) {
  const style = extractStyleCategory(prompt);

  const flavorParts = prompt
    .split(/,|\band\b/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, 10);

  const flavors = flavorParts.length > 0 ? flavorParts : [prompt.trim()];

  return searchInputSchema.parse({
    flavors,
    style_category: style,
  });
}

const BREWBUDDY_CHAT_SYSTEM_PROMPT =
  "You are BrewBuddy, a friendly craft-beer guide. Help users find beers they are likely to enjoy by asking short follow-up questions when the flavor profile is too broad. When the user gives flavor cues or a style preference, use the search_beers_by_flavor tool to look up matches. Keep responses concise, conversational, and practical. Avoid inventing tasting notes that public brewery data does not provide.";

const GATEWAY_GEMINI_MODEL = "google/gemini-3.1-pro-preview";
const LOCAL_GEMINI_MODEL = "gemini-2.5-flash";

function readEnvVar(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function looksLikeGoogleApiKey(value: string): boolean {
  return value.startsWith("AIza");
}

function resolveLocalGeminiApiKey(): string | null {
  const explicitLocalKey =
    readEnvVar("GOOGLE_GENERATIVE_AI_API_KEY") ?? readEnvVar("GEMINI_API_KEY");

  if (explicitLocalKey) {
    return explicitLocalKey;
  }

  const gatewayKey = readEnvVar("AI_GATEWAY_API_KEY");

  if (gatewayKey && looksLikeGoogleApiKey(gatewayKey)) {
    return gatewayKey;
  }

  return null;
}

function resolveGeminiModel() {
  const gatewayKey = readEnvVar("AI_GATEWAY_API_KEY");

  if (gatewayKey && !looksLikeGoogleApiKey(gatewayKey)) {
    return gateway(GATEWAY_GEMINI_MODEL);
  }

  const localGeminiApiKey = resolveLocalGeminiApiKey();

  if (!localGeminiApiKey) {
    return null;
  }

  const google = createGoogleGenerativeAI({ apiKey: localGeminiApiKey });
  return google(LOCAL_GEMINI_MODEL);
}

function canUseGeminiChat(): boolean {
  return resolveGeminiModel() !== null;
}

function parseChatRequest(
  rawBody: unknown,
): { messages: BrewBuddyUIMessage[]; prompt: string | null } | null {
  if (typeof rawBody !== "object" || rawBody === null) {
    return null;
  }

  const candidate = rawBody as { messages?: unknown };

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    return null;
  }

  if (!candidate.messages.every(isChatRequestMessage)) {
    return null;
  }

  const messages = candidate.messages as BrewBuddyUIMessage[];

  return {
    messages,
    prompt: extractLatestUserPrompt(candidate.messages),
  };
}

function createPromptRequiredResponse(): Response {
  const stream = createUIMessageStream<BrewBuddyUIMessage>({
    execute: async ({ writer }) => {
      const textId = `chat-response-${crypto.randomUUID()}`;

      writer.write({
        type: "text-start",
        id: textId,
      });

      writer.write({
        type: "data-error",
        data: {
          message: "Please share a flavor profile so I can recommend beers.",
        },
      });

      writer.write({
        type: "text-delta",
        id: textId,
        delta:
          "I need a flavor profile first. Try something like: citrus and pine IPA.",
      });

      writer.write({
        type: "text-end",
        id: textId,
      });
    },
    onError: () => "Chat stream failed",
  });

  return createUIMessageStreamResponse({ stream });
}

async function enrichSearchResponse(
  response: SearchResponse,
  enricher: BeerEnrichmentService,
): Promise<SearchResponse> {
  if (response.beers.length === 0) {
    return response;
  }

  const enrichedBeers = await Promise.all(
    response.beers.map(async (beer): Promise<BeerResult> => {
      try {
        const enrichment = await enricher.enrichBeer(beer);
        if (!enrichment) {
          return beer;
        }

        // Preserve WineVybe identity fields and only append enrichment details.
        return {
          ...beer,
          enrichment,
        };
      } catch {
        return beer;
      }
    }),
  );

  return {
    ...response,
    beers: enrichedBeers,
  };
}

async function createGeminiChatResponse(
  messages: BrewBuddyUIMessage[],
  maxSteps: number,
): Promise<Response> {
  const model = resolveGeminiModel();

  if (!model) {
    throw new Error("Gemini model is not configured");
  }

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    system: BREWBUDDY_CHAT_SYSTEM_PROMPT,
    stopWhen: stepCountIs(maxSteps),
    tools: {
      [brewBuddyBeerSearchToolName]: tool({
        description:
          "Search public brewery data for beers that match flavor cues and style preferences.",
        inputSchema: searchInputSchema,
        execute: async (input) => {
          const { cache, service, enricher } = createSearchServiceContext();

          try {
            const baseResult = await service.search(input);
            return await enrichSearchResponse(baseResult, enricher);
          } finally {
            cache.close();
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onError: () => "Chat stream failed",
  });
}

function createFallbackChatResponse(
  prompt: string,
  maxSteps: number,
): Response {
  const stream = createUIMessageStream<BrewBuddyUIMessage>({
    execute: async ({ writer }) => {
      const textId = `chat-response-${crypto.randomUUID()}`;

      writer.write({
        type: "text-start",
        id: textId,
      });

      writer.write({
        type: "text-delta",
        id: textId,
        delta: getLoadingCopy(),
      });

      writer.write({
        type: "data-loading",
        data: {
          state: "pending",
        },
      });

      let closeCache: (() => void) | null = null;

      try {
        const { cache, service, enricher } = createSearchServiceContext();
        closeCache = () => cache.close();

        const attemptPlan = createSearchAttemptPlan(
          toSearchInput(prompt),
          maxSteps,
        );

        let resolvedResult: SearchResponse | null = null;

        for (let index = 0; index < attemptPlan.length; index += 1) {
          const currentStep = index + 1;
          const stepResult = ensureVisiblePublicDataWarning(
            await service.search(attemptPlan[index]!),
          );

          if (
            !shouldRetryForEmptyResults(
              stepResult,
              currentStep,
              attemptPlan.length,
            )
          ) {
            resolvedResult = stepResult;
            break;
          }

          const nextStep = currentStep + 1;
          const retryMessage = getRetryCopy(nextStep, attemptPlan.length);

          writer.write({
            type: "data-retry",
            data: {
              attempt: nextStep,
              max_steps: attemptPlan.length,
              message: retryMessage,
            },
          });

          writer.write({
            type: "text-delta",
            id: textId,
            delta: ` ${retryMessage}`,
          });
        }

        if (resolvedResult && resolvedResult.beers.length > 0) {
          resolvedResult = await enrichSearchResponse(resolvedResult, enricher);
        }

        writer.write({
          type: "data-loading",
          data: {
            state: "done",
          },
        });

        if (!resolvedResult || resolvedResult.beers.length === 0) {
          const warning = resolvedResult?.warning?.toLowerCase() ?? "";
          const hasProviderIssue =
            warning.includes("temporarily unavailable") ||
            warning.includes("timed out") ||
            warning.includes("malformed");

          if (hasProviderIssue) {
            const providerWarning =
              resolvedResult?.warning ?? "Provider temporarily unavailable";

            writer.write({
              type: "data-error",
              data: {
                message: toReadableChatErrorMessage(new Error(providerWarning)),
              },
            });

            writer.write({
              type: "text-delta",
              id: textId,
              delta:
                " I hit a public data provider issue while retrying. Please try again in a moment.",
            });

            writer.write({
              type: "text-end",
              id: textId,
            });

            return;
          }

          writer.write({
            type: "data-empty",
            data: {
              message: getControlledEmptyStateCopy(attemptPlan.length),
            },
          });

          writer.write({
            type: "text-delta",
            id: textId,
            delta:
              " I could not find close matches after retrying. Try sharper flavor cues like citrus peel or dark roast.",
          });
        } else {
          writer.write({
            type: "data-recommendations",
            data: resolvedResult,
          });

          writer.write({
            type: "text-delta",
            id: textId,
            delta: resolvedResult.warning
              ? " Here are a few options. One note: public brewery data has limited tasting detail."
              : " Here are a few options to start with.",
          });
        }
      } catch (error) {
        writer.write({
          type: "data-loading",
          data: {
            state: "done",
          },
        });

        const readableError = toReadableChatErrorMessage(error);

        writer.write({
          type: "data-error",
          data: {
            message: readableError,
          },
        });

        writer.write({
          type: "text-delta",
          id: textId,
          delta: ` ${readableError}`,
        });
      } finally {
        closeCache?.();
      }

      writer.write({
        type: "text-end",
        id: textId,
      });
    },
    onError: () => "Chat stream failed",
  });

  return createUIMessageStreamResponse({ stream });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: "Invalid request payload",
        message: "Request body must be valid JSON",
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      },
    );
  }

  const parsedRequest = parseChatRequest(body);

  if (!parsedRequest?.prompt) {
    return createPromptRequiredResponse();
  }

  const maxSteps = resolveChatMaxSteps();

  if (canUseGeminiChat()) {
    try {
      return await createGeminiChatResponse(parsedRequest.messages, maxSteps);
    } catch {
      // Fall back to deterministic search when Gemini is unavailable.
    }
  }

  return createFallbackChatResponse(parsedRequest.prompt, maxSteps);
}
