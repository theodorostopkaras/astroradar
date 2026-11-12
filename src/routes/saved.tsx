import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchFavoriteIds,
  fetchOpportunities,
  toggleFavorite,
  type Opportunity,
} from "@/lib/opportunities";
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
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["opportunities"],
    queryFn: fetchOpportunities,
    enabled: !!user,
  });
  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: () => fetchFavoriteIds(user!.id),
    enabled: !!user,
  });

  const saved = items.filter((i) => favorites.includes(i.id));

  async function onToggleSave(item: Opportunity) {
    if (!user) return;
    await toggleFavorite(user.id, item.id, false);
    queryClient.invalidateQueries({ queryKey: ["favorites", user.id] });
    toast.success("Removed from your shortlist");
  }

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10">
      <h1 className="text-3xl">Your shortlist</h1>

      {loading ? null : !user ? (
        <div className="panel mt-6 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to keep a shortlist of the calls and positions you care about.
          </p>
          <Button asChild className="mt-4">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
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
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {saved.map((item) => (
            <OpportunityCard key={item.id} item={item} saved onToggleSave={onToggleSave} />
          ))}
        </div>
      )}
    </div>
  );
}
