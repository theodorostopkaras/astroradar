import { collectAllSources } from "./sources.server";

export type RefreshSummary = {
  ranAt: string;
  total: number;
  skipped: boolean;
  sources: Array<{ source: string; ok: boolean; found: number; message: string | null }>;
};

/** Minimum time between real scans; extra requests reuse the last run. */
export const REFRESH_COOLDOWN_MS = 30 * 60 * 1000;

export async function runRefresh(): Promise<RefreshSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: recent } = await supabaseAdmin
    .from("source_runs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1);

  const last = recent?.[0]?.ran_at ? new Date(recent[0].ran_at).getTime() : 0;
  if (Date.now() - last < REFRESH_COOLDOWN_MS) {
    const { count } = await supabaseAdmin
      .from("opportunities")
      .select("id", { count: "exact", head: true });
    return {
      ranAt: new Date(last).toISOString(),
      total: count ?? 0,
      skipped: true,
      sources: [],
    };
  }

  const results = await collectAllSources();
  const rows = results.flatMap((r) =>
    r.items.map((item) => ({ ...item, updated_at: new Date().toISOString() })),
  );

  if (rows.length > 0) {
    const { error } = await supabaseAdmin
      .from("opportunities")
      .upsert(rows, { onConflict: "source,external_id" });
    if (error) throw new Error(error.message);
  }

  await supabaseAdmin.from("source_runs").insert(
    results.map((r) => ({
      source: r.source,
      ok: r.ok,
      message: r.message,
      items_found: r.items.length,
    })),
  );

  return {
    ranAt: new Date().toISOString(),
    total: rows.length,
    skipped: false,
    sources: results.map((r) => ({
      source: r.source,
      ok: r.ok,
      found: r.items.length,
      message: r.message,
    })),
  };
}
