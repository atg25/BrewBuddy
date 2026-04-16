import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BeerCardSkeleton } from "@/app/components/BeerCardSkeleton";

describe("BeerCardSkeleton", () => {
  it("renders immediate loading placeholder markup", () => {
    const html = renderToStaticMarkup(<BeerCardSkeleton />);

    expect(html).toContain("Loading beer recommendation");
    expect(html).toContain('data-testid="beer-card-skeleton"');
    expect(html).toContain('aria-busy="true"');
  });
});
