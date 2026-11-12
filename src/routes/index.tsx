import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Radar, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useFavorites } from "@/hooks/useFavorites";
import {
  daysUntil,
  fetchOpportunities,
  researchField,
  sourceLabel,
  type Opportunity,
} from "@/lib/opportunities";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Astro Postdoc Radar — astronomy postdocs & fellowships" },
      {
        name: "description",
        content:
          "Live listing of postdoctoral fellowships, funding calls and positions in astronomy and astrophysics worldwide, with deadlines, filters and a saved shortlist.",
      },
      { property: "og:title", content: "Astro Postdoc Radar" },
      {
        property: "og:description",
        content:
          "European postdoctoral grants and positions in astronomy and astrophysics, updated automatically.",
      },
    ],
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { favorites, toggle } = useFavorites();

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [country, setCountry] = useState("all");
  const [source, setSource] = useState("all");
  const [field, setField] = useState("all");
  const [sort, setSort] = useState("deadline");

  const { data: items = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunities,
  });

  const countries = useMemo(
    () => [...new Set(items.map((i) => i.country).filter(Boolean) as string[])].sort(),
    [items],
  );
  const sources = useMemo(() => [...new Set(items.map((i) => i.source))].sort(), [items]);
  const fields = useMemo(
    () => [...new Set(items.map((i) => researchField(i)))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (country !== "all" && i.country !== country) return false;
      if (source !== "all" && i.source !== source) return false;
      if (field !== "all" && researchField(i) !== field) return false;
      if (!needle) return true;
      return `${i.title} ${i.summary ?? ""} ${i.organisation ?? ""} ${i.tags.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
    return [...list].sort((a, b) => {
      if (sort === "newest") {
        return (
          new Date(b.published_at ?? b.created_at).getTime() -
          new Date(a.published_at ?? a.created_at).getTime()
        );
      }
      const da = daysUntil(a.deadline);
      const db = daysUntil(b.deadline);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [items, q, kind, country, source, field, sort]);

  const closingSoon = useMemo(
    () =>
      items.filter((i) => {
        const d = daysUntil(i.deadline);
        return d !== null && d >= 0 && d <= 30;
      }).length,
    [items],
  );

  function onToggleSave(item: Opportunity) {
    const on = !favorites.includes(item.id);
    toggle(item.id, on);
    toast.success(on ? "Saved to your shortlist" : "Removed from your shortlist");
  }

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10">
      <header className="panel overflow-hidden p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">
              <Radar className="h-3.5 w-3.5" /> Auto-scanning sources worldwide
            </span>
            <h1 className="mt-4 text-4xl leading-tight sm:text-5xl">
              <span className="aurora-text">Postdoctoral funding</span> for astronomy
              &amp; astrophysics
            </h1>
            <p className="mt-4 text-sm text-muted-foreground sm:text-base">
              Postdoc positions and fellowships from INSPIRE, Academic Jobs Online, the EAS
              job directory, jobs.ac.uk, Nature, Science and Physics Today careers, ESO, ESA,
              plus EU funding calls, all in one place and sorted by deadline.

            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Scanning…" : "Scan for new listings"}
            </Button>
            <div className="text-right text-xs text-muted-foreground">
              <div>{items.length} listings tracked</div>
              <div>{closingSoon} closing within 30 days</div>
            </div>
          </div>
        </div>
      </header>

      <div className="panel mt-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cosmology, exoplanets, MSCA…"
            className="pl-9"
          />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="grant">Funding calls</SelectItem>
            <SelectItem value="position">Positions</SelectItem>
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={field} onValueChange={setField}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Research field" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All research fields</SelectItem>
            {fields.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {sourceLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline">Deadline first</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Loading listings…</p>
      ) : filtered.length === 0 ? (
        <div className="panel mt-6 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing matches yet. Try clearing the filters or run a fresh scan.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <OpportunityCard
              key={item.id}
              item={item}
              saved={favorites.includes(item.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
