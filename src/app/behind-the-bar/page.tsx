import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Behind The Bar | BrewBuddy",
  description:
    "Deep dive into BrewBuddy architecture: web app, chat orchestration, a companion MCP server, caching, and backend services.",
};

const architectureRows = [
  {
    layer: "Web UI (Next.js App Router)",
    role: "Captures prompts, streams assistant responses, and renders recommendation cards.",
    source: "src/app/page.tsx",
  },
  {
    layer: "Chat API Route",
    role: "Runs model/tool loop, retries searches, and emits structured stream parts.",
    source: "src/app/api/chat/route.ts",
  },
  {
    layer: "Search Service",
    role: "Validates input, checks cache, queries provider adapter, normalizes output.",
    source: "src/lib/server/services/searchService.ts",
  },
  {
    layer: "Provider Adapter",
    role: "Maps WineVybe master list data into BrewBuddy beer result schema.",
    source: "src/lib/server/adapters/wineVybe.ts",
  },
  {
    layer: "Cache Repository",
    role: "Persists search and enrichment payloads in SQLite with TTL expiration.",
    source: "src/lib/server/cache/repository.ts",
  },
  {
    layer: "MCP Server",
    role: "Exposes search/details tools and prompt resources over MCP for external clients; the web app does not depend on it at runtime.",
    source: "apps/mcp-server/src/server/createBrewBuddyServer.ts",
  },
];

const flowSteps = [
  {
    title: "1. Prompt arrives",
    text: "The chat composer posts UI messages to /api/chat. Prompt text is parsed into flavor tokens and optional style hints.",
  },
  {
    title: "2. Tool plan executes",
    text: "The route selects model path (Gemini when configured) and invokes search_beers_by_flavor tool. If no direct match appears, it broadens the search input with bounded retries.",
  },
  {
    title: "3. Data retrieval",
    text: "SearchService checks SQLite first. Cache misses call the WineVybe adapter, which scores master-list entries against flavor/style tokens and returns top candidates.",
  },
  {
    title: "4. Optional enrichment",
    text: "BeerEnrichmentService adds trusted-web hints (style detail, tasting clues, links) when available. Failures degrade safely without breaking the transcript.",
  },
  {
    title: "5. Streamed response",
    text: "The API emits structured parts (loading, retry, recommendations, empty, error). The UI maps them into status notices and recommendation cards in real time.",
  },
];

const mcpNotes = [
  "This server is separate from the web app runtime and only matters for MCP-capable clients.",
  "Tools are defined with input/output schemas so callers get predictable contracts.",
  "Search tool is cache-first and returns controlled warnings instead of crashing.",
  "Details tool resolves beer details via catalog identity + provider lookups.",
  "Prompt and catalog resources are exposed through MCP for agent/tool consumers.",
  "Server lifecycle manages SQLite resources to avoid leaked handles.",
];

const reliabilityNotes = [
  "Schema validation on both request and response boundaries (Zod).",
  "Controlled empty-state copy after retry budget exhaustion.",
  "Readable error mapping for timeout/outage/data-shape failures.",
  "TTL-based caching for search and enrichment payloads.",
  "Test coverage across route, service, adapter, cache, and mapper layers.",
];

export default function BehindTheBarPage() {
  return (
    <div className="min-h-screen w-screen bg-[var(--background)]">
      <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[linear-gradient(180deg,#17120e_0%,#100c09_100%)] text-amber-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-10%,rgba(235,167,90,0.16),transparent_42%),radial-gradient(circle_at_90%_8%,rgba(198,112,34,0.12),transparent_36%)]" />

        <header className="relative border-b border-white/10 px-4 py-6 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
              BrewBuddy
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-amber-100/80 transition hover:border-amber-200/50 hover:text-amber-50"
              >
                Back To Chat
              </Link>
              <span className="rounded-full border border-amber-200/35 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.32em] text-amber-100/80 backdrop-blur">
                Engineering Deep Dive
              </span>
            </div>
          </div>

          <h1 className="mt-3 max-w-5xl font-serif text-4xl font-semibold tracking-tight text-amber-50 sm:text-5xl lg:text-6xl">
            Behind The Bar
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-amber-100/80 sm:text-base">
            A detailed walkthrough of how BrewBuddy chat, MCP tooling, and
            backend services work together to turn flavor prompts into reliable
            beer recommendations.
          </p>
        </header>

        <section className="relative mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8 lg:px-10">
          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="font-serif text-2xl text-amber-50 sm:text-3xl">
              System Map
            </h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              BrewBuddy is split into composable layers so UI behavior,
              orchestration, and data retrieval can evolve independently.
            </p>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-black/25 text-amber-100/90">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Layer</th>
                    <th className="px-4 py-3 font-semibold">What It Does</th>
                    <th className="px-4 py-3 font-semibold">
                      Primary Location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {architectureRows.map((row) => (
                    <tr
                      key={row.layer}
                      className="border-t border-white/10 text-amber-100/85"
                    >
                      <td className="px-4 py-3 font-semibold text-amber-50">
                        {row.layer}
                      </td>
                      <td className="px-4 py-3">{row.role}</td>
                      <td className="px-4 py-3 text-amber-200/80">
                        {row.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="font-serif text-2xl text-amber-50 sm:text-3xl">
              Request Lifecycle
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {flowSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-amber-200/20 bg-black/20 p-4"
                >
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-100/90">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-amber-100/80">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="font-serif text-2xl text-amber-50 sm:text-3xl">
                MCP Layer
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                The MCP server is a companion surface for MCP-capable clients,
                not part of the website runtime. It packages BrewBuddy
                capabilities as explicit tools and resources so agents and
                desktop clients can reuse the same logic.
              </p>
              <ul className="mt-4 ml-5 list-disc space-y-2 text-sm leading-6 text-amber-100/85">
                {mcpNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <h2 className="font-serif text-2xl text-amber-50 sm:text-3xl">
                Reliability Controls
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-100/80">
                The backend is designed to fail soft and keep the chat
                experience stable under provider variability.
              </p>
              <ul className="mt-4 ml-5 list-disc space-y-2 text-sm leading-6 text-amber-100/85">
                {reliabilityNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>
          </div>

          <article className="rounded-3xl border border-amber-300/30 bg-[linear-gradient(135deg,rgba(187,113,35,0.32),rgba(95,53,17,0.28))] p-6">
            <h2 className="font-serif text-2xl text-amber-50 sm:text-3xl">
              Why This Architecture
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-amber-50/90 sm:text-base">
              BrewBuddy separates experience, orchestration, and data contracts
              so it can iterate quickly without sacrificing reliability. The
              chat route owns conversation flow, services own business logic,
              adapters own external data translation, and MCP exposes reusable
              capability boundaries.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
