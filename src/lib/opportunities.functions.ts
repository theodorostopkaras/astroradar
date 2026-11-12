import { createServerFn } from "@tanstack/react-start";
import type { NormalizedItem, SourceResult } from "./sources.server";

export type ScanResult = {
  ranAt: string;
  items: NormalizedItem[];
  sources: Array<{ source: string; ok: boolean; found: number; message: string | null }>;
};

const CACHE_MS = 30 * 60 * 1000;
// ponytail: per-instance memory cache; a cold Vercel instance re-scrapes (~3s). Add KV/DB if that gets slow.
let cache: { at: number; result: ScanResult } | undefined;

export const getOpportunities = createServerFn({ method: "GET" }).handler(
  async (): Promise<ScanResult> => {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.result;
    const { collectAllSources } = await import("./sources.server");
    const results: SourceResult[] = await collectAllSources();
    const result: ScanResult = {
      ranAt: new Date().toISOString(),
      items: results.flatMap((r) => r.items),
      sources: results.map((r) => ({
        source: r.source,
        ok: r.ok,
        found: r.items.length,
        message: r.message,
      })),
    };
    cache = { at: Date.now(), result };
    return result;
  },
);
