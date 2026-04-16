import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSearchServiceContext } from "@/lib/server/services/createSearchService";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let closeCache: (() => void) | null = null;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        message: "Request body must be valid JSON",
      },
      { status: 400 },
    );
  }

  try {
    const { service, cache } = createSearchServiceContext();
    closeCache = () => cache.close();

    const result = await service.search(body);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Search service failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  } finally {
    closeCache?.();
  }
}
