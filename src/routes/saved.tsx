import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useFavorites } from "@/hooks/useFavorites";
import { fetchOpportunities, type Opportunity } from "@/lib/opportunities";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Your shortlist — Astro Postdoc Radar" },
      {
        name: "description",
        content:
          "Your saved astronomy and astrophysics postdoctoral funding calls and positions, sorted by upcoming deadline.",
      },
      { property: "og:title", content: "Your shortlist — Astro Postdoc Radar" },
      {
        property: "og:description",
        content: "Saved postdoc grants and positions with their deadlines.",
      },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { favorites, toggle } = useFavorites();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunities,
  });

  const saved = items.filter((i) => favorites.includes(i.id));

  function onToggleSave(item: Opportunity) {
    toggle(item.id, false);
    toast.success("Removed from your shortlist");
  }

  return (
    <div className="relative z-10 mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8 pb-24 pt-10">
      <h1 className="text-3xl">Your shortlist</h1>

      {isLoading ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : saved.length === 0 ? (
        <div className="panel mt-6 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing saved yet. Tap the star on any listing to add it here.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">Browse opportunities</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {saved.map((item) => (
            <OpportunityCard key={item.id} item={item} saved onToggleSave={onToggleSave} />
          ))}
        </div>
      )}
    </div>
  );
}
