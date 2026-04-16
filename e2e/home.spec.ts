import { test, expect } from "@playwright/test";

function buildSseBody(chunks: unknown[]): string {
  const events = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`);
  events.push("data: [DONE]\n\n");
  return events.join("");
}

test("automatically retries and renders recommendations after initial empty result", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
      },
      body: buildSseBody([
        { type: "text-start", id: "assistant-1" },
        {
          type: "text-delta",
          id: "assistant-1",
          delta: "Searching for close flavor matches.",
        },
        { type: "data-loading", data: { state: "pending" } },
        {
          type: "data-retry",
          data: {
            attempt: 2,
            max_steps: 3,
            message: "No direct match yet. Broadening search (2/3).",
          },
        },
        {
          type: "data-recommendations",
          data: {
            beers: [
              {
                id: "u-1",
                name: "Night Porter",
                brewery: "North Brew",
                style: "porter",
                description: "Coffee and cocoa",
                abv: 5.8,
                image_url: "https://example.com/porter.png",
                external_url: "http://127.0.0.1:3100/beer/u-1",
                source: "openbrewerydb",
                warning: null,
              },
            ],
            source: "openbrewerydb",
            cache_hit: false,
            warning: null,
          },
        },
        { type: "data-loading", data: { state: "done" } },
        {
          type: "text-delta",
          id: "assistant-1",
          delta: " Here are a few options to start with.",
        },
        { type: "text-end", id: "assistant-1" },
      ]),
    });
  });

  await page.goto("/");
  await expect(page.getByLabel("Flavor query")).toHaveAttribute(
    "autocomplete",
    "off",
  );
  await page.getByLabel("Flavor query").fill("coffee and cocoa");
  await page.getByLabel("Flavor query").press("Enter");

  await expect(page.getByText(/Broadening search \(2\/3\)/i)).toBeVisible();
  await expect(page.getByText("Night Porter")).toBeVisible();

  const [newPage] = await Promise.all([
    page.context().waitForEvent("page"),
    page.getByRole("link", { name: "View brewery page" }).first().click(),
  ]);

  await newPage.waitForLoadState("domcontentloaded");
  expect(newPage.url()).toContain("/beer/u-1");
});

test("shows a short visible warning for fallback recommendations", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
      },
      body: buildSseBody([
        { type: "text-start", id: "assistant-2" },
        { type: "data-loading", data: { state: "pending" } },
        {
          type: "data-recommendations",
          data: {
            beers: [
              {
                id: "fb-1",
                name: "Fallback Lager",
                brewery: "City Brewery",
                style: "lager",
                description: "Clean finish",
                abv: 5.0,
                image_url: null,
                external_url: null,
                source: "openbrewerydb",
                warning:
                  "Detailed tasting notes unavailable in public brewery data",
              },
            ],
            source: "openbrewerydb",
            cache_hit: false,
            warning:
              "Detailed tasting notes unavailable in public brewery data",
          },
        },
        { type: "data-loading", data: { state: "done" } },
        {
          type: "text-delta",
          id: "assistant-2",
          delta:
            " Here are a few options. One note: public brewery data has limited tasting detail.",
        },
        { type: "text-end", id: "assistant-2" },
      ]),
    });
  });

  await page.goto("/");
  await page.getByLabel("Flavor query").fill("light and crisp lager");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText(/public brewery data has limited tasting detail/i),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Detailed tasting notes unavailable in public brewery data/i)
      .first(),
  ).toBeVisible();
});

test("keeps cards readable on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
      },
      body: buildSseBody([
        { type: "text-start", id: "assistant-3" },
        { type: "data-loading", data: { state: "pending" } },
        {
          type: "data-recommendations",
          data: {
            beers: [
              {
                id: "u-1",
                name: "Night Porter",
                brewery: "North Brew",
                style: "porter",
                description: "Coffee and cocoa",
                abv: 5.8,
                image_url: null,
                external_url: null,
                source: "openbrewerydb",
                warning: null,
              },
              {
                id: "u-2",
                name: "Citrus IPA",
                brewery: "Hop House",
                style: "ipa",
                description: "Bright citrus",
                abv: 6.2,
                image_url: null,
                external_url: null,
                source: "openbrewerydb",
                warning: null,
              },
            ],
            source: "openbrewerydb",
            cache_hit: false,
            warning: null,
          },
        },
        { type: "data-loading", data: { state: "done" } },
        { type: "text-end", id: "assistant-3" },
      ]),
    });
  });

  await page.goto("/");
  await page.getByLabel("Flavor query").fill("mobile layout test");
  await page.getByRole("button", { name: "Send" }).click();

  const firstCard = page.getByTestId("beer-card-u-1");
  const secondCard = page.getByTestId("beer-card-u-2");

  await expect(firstCard).toBeVisible();
  await expect(secondCard).toBeVisible();

  const firstBox = await firstCard.boundingBox();
  const secondBox = await secondCard.boundingBox();

  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();

  if (!firstBox || !secondBox) {
    return;
  }

  expect(secondBox.y).toBeGreaterThan(firstBox.y);
});

test("shows controlled empty-state after retry budget is exhausted", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
      },
      body: buildSseBody([
        { type: "text-start", id: "assistant-4" },
        { type: "data-loading", data: { state: "pending" } },
        {
          type: "data-retry",
          data: {
            attempt: 2,
            max_steps: 2,
            message: "No direct match yet. Broadening search (2/2).",
          },
        },
        {
          type: "data-empty",
          data: {
            message:
              "No close matches found after 2 attempts. Try a different flavor cue.",
          },
        },
        { type: "data-loading", data: { state: "done" } },
        { type: "text-end", id: "assistant-4" },
      ]),
    });
  });

  await page.goto("/");
  await page.getByLabel("Flavor query").fill("intentionally empty query");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/after 2 attempts/i)).toBeVisible();
  await expect(page.locator("[data-testid^='beer-card-']")).toHaveCount(0);
});

test("keeps chat usable when network fails during retry", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/");
  await page.getByLabel("Flavor query").fill("citrus and pine");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText(/We could not complete that request/i),
  ).toBeVisible();
  await expect(page.getByLabel("Flavor query")).toBeEnabled();
});

test("contains malformed recommendation payload without breaking transcript", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
      },
      body: buildSseBody([
        { type: "text-start", id: "assistant-5" },
        { type: "data-loading", data: { state: "pending" } },
        {
          type: "data-recommendations",
          data: {
            bad: true,
          },
        },
        { type: "data-loading", data: { state: "done" } },
        {
          type: "text-delta",
          id: "assistant-5",
          delta: "Here is what I could parse.",
        },
        { type: "text-end", id: "assistant-5" },
      ]),
    });
  });

  await page.goto("/");
  await page.getByLabel("Flavor query").fill("malformed fallback");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByText(/Some recommendation data could not be rendered/i),
  ).toBeVisible();
  await expect(page.getByText(/Here is what I could parse/i)).toBeVisible();
  await expect(page.getByLabel("Flavor query")).toBeEnabled();
});
