import { Link } from "@tanstack/react-router";
import { Star, CalendarClock, MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  daysUntil,
  formatDeadline,
  sourceLabel,
  type Opportunity,
} from "@/lib/opportunities";

export function DeadlinePill({ deadline }: { deadline: string | null }) {
  const days = daysUntil(deadline);
  const urgent = days !== null && days <= 21 && days >= 0;
  const past = days !== null && days < 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        past
          ? "bg-muted text-muted-foreground"
          : urgent
            ? "bg-destructive/20 text-destructive-foreground"
            : "bg-accent/15 text-accent"
      }`}
    >
      <CalendarClock className="h-3.5 w-3.5" />
      {formatDeadline(deadline)}
      {days !== null && days >= 0 ? ` · ${days}d left` : past ? " · closed" : ""}
    </span>
  );
}

export function OpportunityCard({
  item,
  saved,
  onToggleSave,
}: {
  item: Opportunity;
  saved: boolean;
  onToggleSave: (item: Opportunity) => void;
}) {
  return (
    <article className="panel group relative flex flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            {item.kind === "grant" ? "Funding call" : "Position"}
          </Badge>
          <span className="text-xs text-muted-foreground">{sourceLabel(item.source)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={saved ? "Remove from saved" : "Save"}
          onClick={() => onToggleSave(item)}
          className="shrink-0"
        >
          <Star className={`h-4 w-4 ${saved ? "fill-accent text-accent" : "text-muted-foreground"}`} />
        </Button>
      </div>

      <Link
        to="/opportunity/$id"
        params={{ id: item.id }}
        className="font-display text-lg leading-snug text-foreground transition-colors hover:text-primary"
      >
        {item.title}
      </Link>

      {item.summary ? (
        <p className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
        <DeadlinePill deadline={item.deadline} />
        {item.country ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {item.country}
          </span>
        ) : null}
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Original listing <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}
