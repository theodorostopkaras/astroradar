import { useEffect, useState } from "react";
import { getFavoriteIds, setFavorite } from "@/lib/opportunities";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  // Read after mount so SSR and first client render match.
  useEffect(() => setFavorites(getFavoriteIds()), []);
  const toggle = (id: string, on: boolean) => setFavorites(setFavorite(id, on));
  return { favorites, toggle };
}
