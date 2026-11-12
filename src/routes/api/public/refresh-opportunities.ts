import { createFileRoute } from "@tanstack/react-router";

async function handle() {
  const { runRefresh } = await import("@/lib/refresh.server");
  return Response.json(await runRefresh());
}

export const Route = createFileRoute("/api/public/refresh-opportunities")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
