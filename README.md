# BrewBuddy Web

BrewBuddy is a creative passion project built after I recently started exploring craft beers and kept running into the same problem: it was easy to find beer names, but hard to understand what was actually similar to the beers I already liked. This app tries to make that search feel conversational, practical, and easy to follow.

Instead of dumping a giant list of results on the screen, BrewBuddy helps users describe flavors, compare styles, and get recommendations that are grounded in public brewery data. The goal is simple: make beer discovery feel more like talking to someone who understands the flavor profile you want.

## What This App Does

BrewBuddy is the web experience for the project. It combines a chat UI, a streaming recommendation flow, and backend search services.

The monorepo also includes a companion MCP server. That server is optional for the website itself, but it exposes the same BrewBuddy search and detail capabilities through the MCP protocol so external agent or desktop clients can reuse the same logic.

The main user flow is:

1. A user describes a flavor profile, beer style, or beer they already enjoy.
2. The chat route converts that into a structured search request.
3. The search service checks cache, queries the public brewery catalog, and ranks matches.
4. The UI streams back response text and beer cards as data arrives.
5. If the data is weak or unavailable, the app falls back to clear, controlled copy instead of noisy failures.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- AI SDK for streaming chat and tool orchestration
- Zod for request and response validation
- better-sqlite3 for local cache storage
- Vitest for unit and integration tests
- Playwright for end-to-end tests

## Repository Layout

This workspace contains two app packages:

- `apps/web` - the Next.js web app you are reading now
- `apps/mcp-server` - a companion MCP server that exposes BrewBuddy tools and resources

Within `apps/web`, the important folders are:

- `src/app` - routes, layouts, UI components, and API handlers
- `src/lib` - client helpers, server services, adapters, caches, and shared types
- `tests` - Vitest unit and integration coverage
- `e2e` - Playwright browser tests

## Routes And Pages

### UI routes

- `/` - main BrewBuddy chat experience
- `/behind-the-bar` - an in-depth explanation page for the product, architecture, and design choices

### API routes

- `/api/chat` - chat orchestration and streamed responses
- `/api/search` - direct search endpoint for structured beer lookups

### Static assets

- `src/app/icon.svg` and `public/buddyIcon.svg` provide the BrewBuddy mug icon branding

## How The App Is Organized

### `src/app`

The App Router layer contains the user-facing experience:

- `layout.tsx` sets global metadata, fonts, and shell styling
- `page.tsx` is the main chat interface
- `behind-the-bar/page.tsx` is the long-form explainer page
- `api/chat/route.ts` handles streamed chat and tool usage
- `api/search/route.ts` handles direct search requests
- `components/BeerCard.tsx` renders recommendation cards
- `components/BeerCardSkeleton.tsx` renders loading placeholders

### `src/lib/client`

Client-side helpers keep the UI focused and readable:

- `layout.ts` provides responsive class helpers
- `recommendationMapper.ts` converts API payloads into card-ready view models

### `src/lib/server`

Server code is split by responsibility:

- `config.ts` loads and validates environment settings
- `cache/` contains cache key generation and SQLite storage
- `adapters/` translates external data into BrewBuddy-friendly schemas
- `chat/agenticLoop.ts` contains retry, empty-state, and error copy helpers
- `services/` contains search orchestration, enrichment, and factory wiring

### `src/lib/types`

Shared Zod schemas define the public data contract:

- `beer.ts` defines beer, search, and enrichment shapes
- `chat.ts` defines chat data parts and tool message types

## Data Flow

The search pipeline is intentionally layered so each step can be tested and changed independently.

1. The user submits a prompt from the chat UI.
2. `api/chat` parses the latest user message and builds a search input.
3. `SearchService` checks the SQLite cache.
4. On a cache miss, the `WineVybeClient` adapter loads and ranks matches from the public brewery catalog.
5. If enrichment data is available, `BeerEnrichmentService` adds extra context and trusted links.
6. The response is streamed back to the UI as structured parts and rendered into cards, warnings, or empty states.

## Design Notes

- The UI is intentionally warm and editorial rather than generic dashboard-style.
- The beer discovery experience favors readability over density.
- Empty states and warnings are kept short and practical.
- The app avoids noisy autofill behavior and keeps the chat transcript easy to scan.
- The architecture separates public data lookup, caching, enrichment, and rendering so the system stays maintainable.

## Environment Variables

The web app reads these values from `apps/web/.env` or the runtime environment:

- `WINEVYBE_BASE_URL` - public brewery API base URL
- `WINEVYBE_MASTER_LIST_URL` - master list used for catalog-backed search
- `RAPIDAPI_HOST` - RapidAPI host header value
- `RAPIDAPI_KEY` - optional RapidAPI key for compatible endpoints
- `DB_PATH` - local SQLite cache path
- `SEARCH_TTL_SECONDS` - cache lifetime for beer search responses
- `DETAILS_TTL_SECONDS` - cache lifetime for beer enrichment responses
- `CHAT_MAX_STEPS` - maximum retry steps for the chat search loop
- `AI_GATEWAY_API_KEY` - optional gateway key for Gemini routing
- `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` - local Gemini API key fallback

## Scripts

Run these from `apps/web`:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run test:e2e
npm run test:all
```

## Testing

The project uses three layers of validation:

- Unit tests for helpers, cards, and data mapping
- Integration tests for cache, routes, services, and adapter behavior
- End-to-end tests for the browser experience and streaming UI

If you change any part of the search flow, update the relevant service and route tests first. If you change how cards render, check the mapper and component tests as well.

## Local Development

1. Install dependencies in `apps/web`.
2. Set up `apps/web/.env` with the required provider and cache values.
3. Run `npm run dev` from `apps/web`.
4. Open the app in the browser and try a few flavor-based prompts.

## Deployment Notes

The app is built for Vercel-style deployment, but it still relies on the configured environment variables and a writable cache path. Before deploying, make sure the runtime environment has the same provider settings you use locally.

## Why The Project Exists

BrewBuddy exists because beer discovery is harder than it looks. Two beers can feel similar in one context and completely different in another, and the labels alone do not always help. This project is my way of turning that confusion into something clearer, more interactive, and more useful.

## Learn More

- Next.js documentation: https://nextjs.org/docs
- Vitest documentation: https://vitest.dev
- Playwright documentation: https://playwright.dev

## Companion Project

The monorepo also includes `apps/mcp-server`, which packages BrewBuddy capabilities as MCP prompts, resources, and tools. It exists for clients that speak MCP, not because the web app needs it at runtime.
