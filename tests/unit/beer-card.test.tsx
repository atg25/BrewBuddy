import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BeerCard } from "@/app/components/BeerCard";

describe("BeerCard", () => {
  it("renders title, brewery, image, and link", () => {
    const html = renderToStaticMarkup(
      <BeerCard
        beer={{
          id: "u-1",
          name: "Night Porter",
          brewery: "North Brew",
          style: "porter",
          styleDetail: null,
          description: "Coffee and cocoa",
          tastingNotes: null,
          awards: null,
          abvHint: null,
          abvLabel: "5.8% ABV",
          imageUrl: "https://example.com/beer.png",
          linkUrl: "https://example.com/beer/u-1",
          sourceLinks: [],
          warning: null,
          sourceLabel: "WineVybe",
        }}
      />,
    );

    expect(html).toContain("Night Porter");
    expect(html).toContain("North Brew");
    expect(html).toContain("img");
    expect(html).toContain("View brewery page");
  });

  it("omits sections when image or link is missing", () => {
    const html = renderToStaticMarkup(
      <BeerCard
        beer={{
          id: "u-2",
          name: "Fallback Lager",
          brewery: "City Brewery",
          style: "lager",
          styleDetail: null,
          description: "Crisp and clean",
          tastingNotes: null,
          awards: null,
          abvHint: null,
          abvLabel: null,
          imageUrl: null,
          linkUrl: null,
          sourceLinks: [],
          warning: null,
          sourceLabel: "WineVybe",
        }}
      />,
    );

    expect(html).not.toContain("No image");
    expect(html).not.toContain("No external link available.");
    expect(html).not.toContain("ABV");
  });
});
