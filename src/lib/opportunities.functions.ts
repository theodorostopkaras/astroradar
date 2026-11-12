import { createServerFn } from "@tanstack/react-start";

export type RefreshSummary = {
  ranAt: string;
  total: number;
  skipped: boolean;
  sources: Array<{ source: string; ok: boolean; found: number; message: string | null }>;
};

export const refreshOpportunities = createServerFn({ method: "POST" }).handler(
  async (): Promise<RefreshSummary> => {
    const { runRefresh } = await import("./refresh.server");
    return runRefresh();
  },
);
