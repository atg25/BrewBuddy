import type { SearchInput, SearchResponse } from "@/lib/types/beer";
import { searchInputSchema } from "@/lib/types/beer";

export const DEFAULT_CHAT_MAX_STEPS = 3;
const MAX_CHAT_MAX_STEPS = 5;
const PUBLIC_DATA_WARNING =
  "Detailed tasting notes unavailable in the WineVybe master list";

export function resolveChatMaxSteps(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const rawMaxSteps = env.CHAT_MAX_STEPS;
  if (!rawMaxSteps) {
    return DEFAULT_CHAT_MAX_STEPS;
  }

  const parsed = Number.parseInt(rawMaxSteps, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_CHAT_MAX_STEPS;
  }

  return Math.min(parsed, MAX_CHAT_MAX_STEPS);
}

function normalizeSearchInput(input: SearchInput): SearchInput {
  return searchInputSchema.parse({
    flavors: input.flavors.map((flavor) => flavor.trim()).filter(Boolean),
    style_category: input.style_category?.trim() || undefined,
  });
}

function createSearchInputKey(input: SearchInput): string {
  const styleKey = input.style_category ?? "any";
  return `${input.flavors.join("|")}:style:${styleKey}`;
}

export function createSearchAttemptPlan(
  initialInput: SearchInput,
  maxSteps: number,
): SearchInput[] {
  const boundedSteps = Math.max(1, maxSteps);
  const normalizedInitial = normalizeSearchInput(initialInput);

  const candidates: SearchInput[] = [
    normalizedInitial,
    {
      ...normalizedInitial,
      style_category: undefined,
    },
  ];

  if (normalizedInitial.flavors.length > 1) {
    candidates.push({
      flavors: [normalizedInitial.flavors[0]],
      style_category: undefined,
    });
  }

  const firstFlavorWord = normalizedInitial.flavors[0]?.split(/\s+/)[0]?.trim();
  if (
    firstFlavorWord &&
    firstFlavorWord.length > 0 &&
    firstFlavorWord !== normalizedInitial.flavors[0]
  ) {
    candidates.push({
      flavors: [firstFlavorWord],
      style_category: undefined,
    });
  }

  const uniquePlan: SearchInput[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeSearchInput(candidate);
    const key = createSearchInputKey(normalizedCandidate);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniquePlan.push(normalizedCandidate);

    if (uniquePlan.length >= boundedSteps) {
      break;
    }
  }

  return uniquePlan;
}

export function shouldRetryForEmptyResults(
  result: SearchResponse,
  currentStep: number,
  maxSteps: number,
): boolean {
  const warning = result.warning?.toLowerCase() ?? "";
  const hasProviderAvailabilityIssue =
    warning.includes("temporarily unavailable") ||
    warning.includes("timed out") ||
    warning.includes("rate limit") ||
    warning.includes("malformed");

  return (
    result.beers.length === 0 &&
    !hasProviderAvailabilityIssue &&
    currentStep < maxSteps
  );
}

export function ensureVisiblePublicDataWarning(
  result: SearchResponse,
): SearchResponse {
  if (result.source === "winevybe" && !result.warning) {
    return {
      ...result,
      warning: PUBLIC_DATA_WARNING,
    };
  }

  return result;
}

export function getLoadingCopy(): string {
  return "Pouring through close flavor matches.";
}

export function getRetryCopy(nextStep: number, maxSteps: number): string {
  return `No direct match yet. Broadening search (${nextStep}/${maxSteps}).`;
}

export function getControlledEmptyStateCopy(attemptCount: number): string {
  return `No close matches poured after ${attemptCount} attempts. Try a different flavor cue.`;
}

export function toReadableChatErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("timed out")) {
    return "The beer lookup timed out. Please try again.";
  }

  if (
    normalized.includes("temporarily unavailable") ||
    normalized.includes("status 5")
  ) {
    return "Beer services are temporarily unavailable. Please try again shortly.";
  }

  if (normalized.includes("malformed")) {
    return "A data issue interrupted recommendations. Please try again.";
  }

  return "Recommendation lookup is temporarily unavailable. Please try again.";
}
