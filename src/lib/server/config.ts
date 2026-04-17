import { z } from "zod";

const envSchema = z.object({
  WINEVYBE_BASE_URL: z.string().url().default("https://beer9.p.rapidapi.com"),
  WINEVYBE_MASTER_LIST_URL: z
    .string()
    .url()
    .default("https://winevybe.com/v/beerapi/beers-master-list-2023.txt"),
  RAPIDAPI_HOST: z.string().default("beer9.p.rapidapi.com"),
  RAPIDAPI_KEY: z.string().min(1).optional(),
  DB_PATH: z.string().min(1),
  SEARCH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),
  DETAILS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dbPathDefault = env.VERCEL ? "/tmp/brewbuddy.sqlite" : ".data/brewbuddy.sqlite";

  const parsed = envSchema.safeParse({
    ...env,
    DB_PATH: env.DB_PATH ?? dbPathDefault,
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new Error(
      `Invalid configuration: ${firstIssue.path.join(".")} ${firstIssue.message}`,
    );
  }

  return parsed.data;
}
