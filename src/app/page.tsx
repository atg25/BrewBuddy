"use client";

import { useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { BeerCard } from "@/app/components/BeerCard";
import { BeerCardSkeleton } from "@/app/components/BeerCardSkeleton";
import {
  getRecommendationGridClass,
  getTranscriptBubbleClass,
} from "@/lib/client/layout";
import { mapRecommendationsToBeerCards } from "@/lib/client/recommendationMapper";
import {
  brewBuddyBeerSearchToolPartType,
  chatDataPartSchemas,
  type BrewBuddyUIMessage,
} from "@/lib/types/chat";

function describeSearchInput(input: {
  flavors: string[];
  style_category?: string;
}): string {
  const flavorText = input.flavors.join(", ");

  if (!input.style_category) {
    return flavorText;
  }

  return `${flavorText} · ${input.style_category}`;
}

function renderBeerRecommendations(
  key: string,
  payload: unknown,
): ReactElement {
  const mapped = mapRecommendationsToBeerCards(payload);

  if (mapped.kind === "malformed") {
    return (
      <p
        key={key}
        className="rounded-xl border border-amber-300/20 bg-amber-100/90 px-3 py-2 text-sm text-stone-900"
      >
        Some recommendation data could not be rendered.
      </p>
    );
  }

  if (mapped.cards.length === 0) {
    return <section key={key} />;
  }

  return (
    <section key={key}>
      {mapped.warning ? (
        <p className="mb-3 rounded-xl border border-amber-300/20 bg-amber-100/90 px-3 py-2 text-sm text-stone-900">
          {mapped.warning}
        </p>
      ) : null}

      {mapped.droppedCount > 0 ? (
        <p className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-amber-100/75">
          Some recommendations were skipped because of malformed data.
        </p>
      ) : null}

      <div className={getRecommendationGridClass(mapped.cards.length)}>
        {mapped.cards.map((beer) => (
          <BeerCard key={beer.id} beer={beer} />
        ))}
      </div>
    </section>
  );
}

function renderInlineBoldSegments(
  text: string,
  keyPrefix: string,
): ReactElement[] {
  const segments = text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((segment) => segment.length > 0);

  return segments.map((segment, index) => {
    const boldMatch = segment.match(/^\*\*([^*]+)\*\*$/);

    if (boldMatch) {
      return (
        <strong key={`${keyPrefix}-bold-${index}`} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
    }

    return <span key={`${keyPrefix}-text-${index}`}>{segment}</span>;
  });
}

function renderAssistantTextPart(
  text: string,
  keyPrefix: string,
): ReactElement[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\s+\*\s+(?=(?:\*\*|[A-Za-z0-9]))/g, "\n* ")
    .trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const elements: ReactElement[] = [];
  let listItems: string[] = [];
  let blockIndex = 0;

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    const currentItems = [...listItems];
    listItems = [];

    elements.push(
      <ul
        key={`${keyPrefix}-list-${blockIndex}`}
        className="ml-5 list-disc space-y-1 text-sm leading-6"
      >
        {currentItems.map((item, itemIndex) => (
          <li key={`${keyPrefix}-list-item-${blockIndex}-${itemIndex}`}>
            {renderInlineBoldSegments(
              item,
              `${keyPrefix}-list-item-${blockIndex}-${itemIndex}`,
            )}
          </li>
        ))}
      </ul>,
    );

    blockIndex += 1;
  };

  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }

    flushList();

    elements.push(
      <p
        key={`${keyPrefix}-paragraph-${blockIndex}`}
        className="text-sm leading-6"
      >
        {renderInlineBoldSegments(line, `${keyPrefix}-paragraph-${blockIndex}`)}
      </p>,
    );

    blockIndex += 1;
  }

  flushList();

  return elements;
}

export default function Home() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat<BrewBuddyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    dataPartSchemas: chatDataPartSchemas,
  });

  const isPending = status === "submitted" || status === "streaming";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPrompt = input.trim();

    if (!nextPrompt) {
      return;
    }

    await sendMessage({ text: nextPrompt });
    setInput("");
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--background)]">
      <main className="relative flex h-full w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#17120e_0%,#100c09_100%)] text-amber-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_-8%,rgba(235,167,90,0.16),transparent_42%),radial-gradient(circle_at_88%_4%,rgba(198,112,34,0.12),transparent_34%)]" />
        <header className="relative border-b border-white/10 px-4 py-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
              BrewBuddy
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/behind-the-bar"
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-amber-100/80 transition hover:border-amber-200/50 hover:text-amber-50"
              >
                Behind The Bar
              </Link>
              <span className="rounded-full border border-amber-200/35 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.32em] text-amber-100/80 backdrop-blur">
                Public data only
              </span>
            </div>
          </div>

          <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-amber-50 sm:text-5xl lg:text-6xl">
            Find your perfect craft beer.
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-100/80 sm:text-base">
            Describe the flavors you want, a style you like, or a beer you
            already enjoy. BrewBuddy will talk through options that fit your
            taste.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5" aria-hidden="true" />
        </header>

        <section
          aria-live="polite"
          suppressHydrationWarning
          className="relative flex-1 space-y-4 overflow-y-auto px-4 pt-5 pb-36 sm:px-8 lg:px-10"
        >
          {messages.length === 0 ? (
            <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-amber-100/80 backdrop-blur-sm">
              Start with flavors, a style, or even a beer you already like. Brew
              Buddy will search the web and talk you through some options that
              fit your taste.
            </div>
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={getTranscriptBubbleClass(
                message.role === "user" ? "user" : "assistant",
              )}
            >
              <p className="mb-2 text-[10px] uppercase tracking-[0.35em] opacity-70">
                {message.role === "user" ? "You" : "BrewBuddy"}
              </p>

              <div className="space-y-3">
                {(() => {
                  const textElements: ReactElement[] = [];
                  const statusElements: ReactElement[] = [];
                  const recommendationElements: ReactElement[] = [];

                  for (const [index, part] of message.parts.entries()) {
                    if (part.type === "text") {
                      if (message.role === "assistant") {
                        textElements.push(
                          ...renderAssistantTextPart(
                            part.text,
                            `${message.id}-text-${index}`,
                          ),
                        );
                      } else {
                        textElements.push(
                          <p
                            key={`${message.id}-text-${index}`}
                            className="text-sm leading-6"
                          >
                            {part.text}
                          </p>,
                        );
                      }
                      continue;
                    }

                    if (part.type === "data-recommendations") {
                      const mapped = mapRecommendationsToBeerCards(part.data);

                      if (mapped.kind === "malformed") {
                        recommendationElements.push(
                          <p
                            key={`${message.id}-malformed-${index}`}
                            className="rounded-xl border border-amber-300/20 bg-amber-100/90 px-3 py-2 text-sm text-stone-900"
                          >
                            Some recommendation data could not be rendered.
                          </p>,
                        );
                        continue;
                      }

                      if (mapped.cards.length === 0) {
                        continue;
                      }

                      recommendationElements.push(
                        renderBeerRecommendations(
                          `${message.id}-cards-${index}`,
                          part.data,
                        ),
                      );
                      continue;
                    }

                    if (part.type === brewBuddyBeerSearchToolPartType) {
                      if (part.state === "input-streaming") {
                        statusElements.push(
                          <p
                            key={`${message.id}-tool-input-streaming-${index}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-100/80"
                          >
                            Searching for matching beers...
                          </p>,
                        );
                        continue;
                      }

                      if (part.state === "input-available") {
                        statusElements.push(
                          <p
                            key={`${message.id}-tool-input-available-${index}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-100/80"
                          >
                            Looking up {describeSearchInput(part.input)}.
                          </p>,
                        );
                        continue;
                      }

                      if (part.state === "output-available") {
                        recommendationElements.push(
                          renderBeerRecommendations(
                            `${message.id}-tool-output-${index}`,
                            part.output,
                          ),
                        );
                        continue;
                      }

                      if (part.state === "output-error") {
                        statusElements.push(
                          <p
                            key={`${message.id}-tool-output-error-${index}`}
                            className="rounded-xl border border-red-300/20 bg-red-100/90 px-3 py-2 text-sm text-red-950"
                          >
                            Beer search failed: {part.errorText}
                          </p>,
                        );
                        continue;
                      }

                      if (part.state === "output-denied") {
                        statusElements.push(
                          <p
                            key={`${message.id}-tool-output-denied-${index}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-100/80"
                          >
                            Beer search was skipped.
                          </p>,
                        );
                      }

                      continue;
                    }

                    if (part.type === "data-retry") {
                      statusElements.push(
                        <p
                          key={`${message.id}-retry-${index}`}
                          className="rounded-xl border border-sky-300/20 bg-sky-100/90 px-3 py-2 text-sm text-sky-950"
                        >
                          {part.data.message}
                        </p>,
                      );
                      continue;
                    }

                    if (part.type === "data-empty") {
                      statusElements.push(
                        <p
                          key={`${message.id}-empty-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-amber-100/80"
                        >
                          {part.data.message}
                        </p>,
                      );
                      continue;
                    }

                    if (part.type === "data-error") {
                      statusElements.push(
                        <p
                          key={`${message.id}-error-${index}`}
                          className="rounded-xl border border-red-300/20 bg-red-100/90 px-3 py-2 text-sm text-red-950"
                        >
                          {part.data.message}
                        </p>,
                      );
                    }
                  }

                  return [
                    ...textElements,
                    ...statusElements,
                    ...recommendationElements,
                  ];
                })()}
              </div>
            </article>
          ))}

          {isPending ? (
            <div className={getRecommendationGridClass(2)}>
              <BeerCardSkeleton />
              <BeerCardSkeleton />
            </div>
          ) : null}
        </section>

        <form
          onSubmit={handleSubmit}
          suppressHydrationWarning
          className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/30 px-4 py-4 backdrop-blur sm:px-8 lg:px-10"
        >
          <label
            htmlFor="flavor-query"
            className="text-[10px] uppercase tracking-[0.35em] text-amber-200/75"
          >
            Flavor query
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="flavor-query"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. bright citrus, pine, crisp finish"
              className="w-full rounded-full border border-white/15 bg-[#23160f] px-4 py-3 text-sm text-amber-50 outline-none placeholder:text-amber-100/35 focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/20"
            />

            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent),#df9a3b)] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#cf8832,#e3aa4d)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send"}
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-xl border border-red-300/20 bg-red-100/90 px-3 py-2 text-sm text-red-950">
              We could not complete that request. You can edit your query and
              try again.
            </p>
          ) : null}
        </form>
      </main>
    </div>
  );
}
