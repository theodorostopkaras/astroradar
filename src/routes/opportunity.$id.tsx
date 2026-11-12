import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeadlinePill } from "@/components/OpportunityCard";
import { useFavorites } from "@/hooks/useFavorites";
import { fetchOpportunity, sourceLabel } from "@/lib/opportunities";

export const Route = createFileRoute("/opportunity/$id")({
  head: () => ({
    meta: [
      { title: "Opportunity details — Astro Postdoc Radar" },
      {
        name: "description",
        content:
          "Full details of an astronomy or astrophysics postdoctoral funding call or position, including deadline, host and eligibility.",
      },
      { property: "og:title", content: "Opportunity details — Astro Postdoc Radar" },
      {
        property: "og:description",
        content: "Deadline, host institution and full description for this postdoc opportunity.",
      },
    ],
  }),
  component: DetailPage,
});

function DetailPage() {
  const { id } = Route.useParams();
  const { favorites, toggle } = useFavorites();

  const { data: item, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => fetchOpportunity(id),
  });

  const saved = !!item && favorites.includes(item.id);

  function onSave() {
    if (item) toggle(item.id, !saved);
  }

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-24 pt-10">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> All opportunities
      </Link>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : !item ? (
        <div className="panel mt-6 p-10 text-center text-sm text-muted-foreground">
          This listing is no longer available.
        </div>
      ) : (
        <article className="panel mt-6 p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">
              {item.kind === "grant" ? "Funding call" : "Position"}
            </Badge>
            <span className="text-xs text-muted-foreground">{sourceLabel(item.source)}</span>
            {item.status ? (
              <span className="text-xs text-muted-foreground">· {item.status}</span>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl leading-tight">{item.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DeadlinePill deadline={item.deadline} />
            {item.organisation ? (
              <span className="text-sm text-muted-foreground">{item.organisation}</span>
            ) : null}
            {item.country ? (
              <span className="text-sm text-muted-foreground">· {item.country}</span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href={item.url} target="_blank" rel="noreferrer">
                Open original listing <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" onClick={onSave}>
              <Star className={`h-4 w-4 ${saved ? "fill-accent text-accent" : ""}`} />
              {saved ? "Saved" : "Save"}
            </Button>
          </div>

          {item.funding ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Programme reference: <span className="text-foreground">{item.funding}</span>
            </p>
          ) : null}

          {item.description ? (
            <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </div>
          ) : null}

          {item.tags.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {item.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
        </article>
      )}
    </div>
  );
}
