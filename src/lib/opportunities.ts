import { supabase } from "@/integrations/supabase/client";

export type Opportunity = {
  id: string;
  source: string;
  external_id: string;
  kind: string;
  title: string;
  organisation: string | null;
  country: string | null;
  location: string | null;
  summary: string | null;
  description: string | null;
  url: string;
  deadline: string | null;
  published_at: string | null;
  funding: string | null;
  status: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export const SOURCE_LABELS: Record<string, string> = {
  "eu-funding-portal": "EU Funding & Tenders Portal",
  "inspire-jobs": "INSPIRE (astronomy postdocs)",
  "eso-announcements": "ESO announcements",
  "eso-recruitment": "ESO fellowships & posts",
  "esa-careers": "ESA research fellowships",
  "dlr-jobs": "DLR (German Aerospace Center)",
  "aas-jobregister": "AAS Job Register (postdocs & fellowships)",
};


export function sourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}

export const RESEARCH_FIELDS = [
  "Cosmology",
  "Gravitational waves & relativity",
  "Exoplanets & planetary science",
  "Stars & galaxies",
  "High-energy astrophysics",
  "Solar & heliophysics",
  "Instrumentation & observatories",
  "General astrophysics",
] as const;

export type ResearchField = (typeof RESEARCH_FIELDS)[number];

const FIELD_PATTERNS: Array<[ResearchField, RegExp]> = [
  ["Cosmology", /cosmolog|dark energy|dark matter|large-scale structure|cmb|astro-ph\.co/i],
  [
    "Gravitational waves & relativity",
    /gravitational wave|ligo|virgo|einstein telescope|lisa|numerical relativity|general relativity|gr-qc/i,
  ],
  [
    "Exoplanets & planetary science",
    /exoplanet|planetary|protoplanetary|astrobiolog|solar system|astro-ph\.ep/i,
  ],
  [
    "High-energy astrophysics",
    /high-energy|x-ray|gamma-ray|neutron star|black hole|pulsar|astropartic|neutrino|astro-ph\.he/i,
  ],
  ["Solar & heliophysics", /solar physic|heliophys|space weather|corona/i],
  [
    "Instrumentation & observatories",
    /instrumentation|detector|telescope|observatory|interferomet|spectrograph|astro-ph\.im/i,
  ],
  ["Stars & galaxies", /galax|stellar|star formation|interstellar|astro-ph\.ga|astro-ph\.sr/i],
];

export function researchField(item: {
  title: string;
  summary: string | null;
  tags: string[];
}): ResearchField {
  const text = `${item.title} ${item.summary ?? ""} ${item.tags.join(" ")}`;
  for (const [field, re] of FIELD_PATTERNS) {
    if (re.test(text)) return field;
  }
  return "General astrophysics";
}


/** True when the deadline has passed (the deadline day itself still counts as open). */
export function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export async function fetchOpportunities(): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Opportunity[]).filter((i) => !isExpired(i.deadline));
}

export async function fetchOpportunity(id: string): Promise<Opportunity | null> {
  const { data, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Opportunity) ?? null;
}

export async function fetchFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("opportunity_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.opportunity_id as string);
}

export async function toggleFavorite(userId: string, opportunityId: string, on: boolean) {
  if (on) {
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: userId, opportunity_id: opportunityId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("opportunity_id", opportunityId);
    if (error) throw new Error(error.message);
  }
}

export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Rolling / not stated";
  return new Date(deadline).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
