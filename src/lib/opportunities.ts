import { getOpportunities } from "./opportunities.functions";

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
  "academic-jobs-online": "Academic Jobs Online",
  "physics-today": "Physics Today Jobs",
  "nature-careers": "Nature Careers",
  "science-careers": "Science Careers",
  "jobs-ac-uk": "jobs.ac.uk",
  "eas-jobs": "EAS Job Directory",
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
  const { ranAt, items } = await getOpportunities();
  return items
    .map((i) => ({ ...i, id: `${i.source}:${i.external_id}`, created_at: ranAt, updated_at: ranAt }))
    .filter((i) => !isExpired(i.deadline));
}

export async function fetchOpportunity(id: string): Promise<Opportunity | null> {
  return (await fetchOpportunities()).find((i) => i.id === id) ?? null;
}

// Shortlist lives in this browser only (no accounts).
const FAV_KEY = "astroradar:favorites";

export function getFavoriteIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function setFavorite(id: string, on: boolean): string[] {
  const next = getFavoriteIds().filter((f) => f !== id);
  if (on) next.push(id);
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: shortlist just won't persist */
  }
  return next;
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
