/**
 * Adapters that pull astronomy / astrophysics postdoctoral funding calls and
 * positions from public sources. Every adapter is failure tolerant: a broken
 * upstream never breaks a refresh run.
 */

export type NormalizedItem = {
  source: string;
  external_id: string;
  kind: "grant" | "position";
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
};

export type SourceResult = {
  source: string;
  ok: boolean;
  message: string | null;
  items: NormalizedItem[];
};

const ASTRO_KEYWORDS = [
  "astronomy",
  "astronomical",
  "astrophysic",
  "cosmolog",
  "exoplanet",
  "galax",
  "gravitational wave",
  "space science",
  "solar physic",
  "stellar",
  "planetary",
  "black hole",
  "telescope",
  "observatory",
  "radio astronom",
  "high-energy astro",
];

const POSTDOC_KEYWORDS = [
  "postdoc",
  "post-doc",
  "fellowship",
  "fellow",
  "early-career researcher",
  "researcher mobility",
];

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function isRelevant(text: string): boolean {
  const t = text.toLowerCase();
  const astro = ASTRO_KEYWORDS.some((k) => t.includes(k));
  const postdoc = POSTDOC_KEYWORDS.some((k) => t.includes(k));
  return astro || postdoc;
}

const EUROPEAN_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Norway", "Poland", "Portugal", "Romania", "Serbia", "Slovakia", "Slovenia", "Spain",
  "Sweden", "Switzerland", "Turkey", "Ukraine", "United Kingdom", "UK", "Scotland",
  "England", "Wales", "Chile",
];

export function guessCountry(text: string): string | null {
  for (const c of EUROPEAN_COUNTRIES) {
    const re = new RegExp(`(^|[\\s,(])${c}([\\s,).]|$)`, "i");
    if (re.test(text)) return c === "UK" || c === "England" || c === "Scotland" || c === "Wales"
      ? "United Kingdom"
      : c === "Czech Republic" ? "Czechia" : c;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* EU Funding & Tenders Portal (Horizon Europe / MSCA / ERC)          */
/* ------------------------------------------------------------------ */

const SEDIA_URL =
  "https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&pageSize=40&pageNumber=1";

const SEDIA_QUERIES = [
  "MSCA postdoctoral fellowships",
  "postdoctoral fellowship researchers",
  "astronomy astrophysics research",
  "space science research infrastructure",
  "ERC starting grant researchers",
];

function first(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key];
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
  return null;
}

const STATUS_LABELS: Record<string, string> = {
  "31094501": "Forthcoming",
  "31094502": "Open",
  "31094503": "Closed",
};

export async function fetchEuPortal(): Promise<SourceResult> {
  const source = "eu-funding-portal";
  const byId = new Map<string, NormalizedItem>();
  try {
    for (const text of SEDIA_QUERIES) {
      const body = new FormData();
      const query = {
        bool: {
          must: [
            { terms: { type: ["1", "2"] } },
            { terms: { status: ["31094501", "31094502"] } },
          ],
        },
      };
      body.append(
        "query",
        new Blob([JSON.stringify(query)], { type: "application/json" }),
        "query.json",
      );
      body.append("languages", new Blob(['["en"]'], { type: "application/json" }), "languages.json");

      const res = await fetch(`${SEDIA_URL}&text=${encodeURIComponent(text)}`, {
        method: "POST",
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        results?: Array<{ url?: string; metadata?: Record<string, unknown> }>;
      };

      for (const r of json.results ?? []) {
        const meta = r.metadata ?? {};
        const identifier = first(meta, "identifier");
        const title = first(meta, "title");
        if (!identifier || !title) continue;

        const descriptionRaw = first(meta, "descriptionByte") ?? "";
        const description = stripHtml(descriptionRaw).slice(0, 4000);
        const haystack = `${title} ${description}`.toLowerCase();
        const astro = ASTRO_KEYWORDS.some((k) => haystack.includes(k));
        const scheme =
          /msca|marie sk|postdoctoral fellowship|era fellowship|erc (starting|consolidator|advanced|synergy)/.test(
            haystack,
          );
        if (!astro && !scheme) continue;

        const deadline = first(meta, "deadlineDate");
        // Skip calls whose deadline has already passed.
        if (deadline && new Date(deadline).getTime() < Date.now()) continue;
        const statusCode = first(meta, "status") ?? "";
        const url =
          "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/" +
          identifier;


        byId.set(identifier, {
          source,
          external_id: identifier,
          kind: "grant",
          title,
          organisation: "European Commission",
          country: "Europe-wide",
          location: "Europe-wide",
          summary: description.slice(0, 320),
          description,
          url: r.url && r.url.includes("topic-details") ? r.url : url,
          deadline: deadline ?? null,
          published_at: first(meta, "startDate"),
          funding: first(meta, "callIdentifier"),
          status: STATUS_LABELS[statusCode] ?? "Open",
          tags: ["Horizon Europe", "EU call"],
        });
      }
    }
    return { source, ok: true, message: null, items: [...byId.values()] };
  } catch (e) {
    return {
      source,
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      items: [...byId.values()],
    };
  }
}

/* ------------------------------------------------------------------ */
/* AAS Job Register (RSS)                                             */
/* ------------------------------------------------------------------ */

type RssItem = {
  get: (tag: string) => string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
};

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  for (const block of blocks) {
    const get = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      if (!m || !m[1]) return "";
      return stripHtml(m[1].replace(/<!\[CDATA\[|\]\]>/g, ""));
    };

    items.push({
      get,
      title: get("title"),
      link: get("link"),
      description: get("description"),
      pubDate: get("pubDate"),
      guid: get("guid"),
    });
  }
  return items;
}

/* ------------------------------------------------------------------ */
/* INSPIRE-HEP jobs (astro-ph postdoctoral positions worldwide)        */
/* ------------------------------------------------------------------ */

type InspireHit = {
  id?: string;
  metadata?: {
    position?: string;
    status?: string;
    deadline_date?: string;
    control_number?: number;
    regions?: string[];
    ranks?: string[];
    arxiv_categories?: string[];
    description?: string;
    institutions?: Array<{ value?: string }>;
    urls?: Array<{ value?: string }>;
  };
};

export async function fetchInspireJobs(): Promise<SourceResult> {
  const source = "inspire-jobs";
  try {
    const params = new URLSearchParams({
      q: "ranks:POSTDOC AND status:open",
      size: "250",
      sort: "mostrecent",
      fields:
        "position,institutions,regions,ranks,arxiv_categories,deadline_date,status,urls,description,control_number",
    });
    const res = await fetch(`https://inspirehep.net/api/jobs?${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { hits?: { hits?: InspireHit[] } };

    const items: NormalizedItem[] = [];
    for (const hit of json.hits?.hits ?? []) {
      const m = hit.metadata ?? {};
      const title = m.position;
      const id = hit.id ?? (m.control_number ? String(m.control_number) : null);
      if (!title || !id) continue;

      const institutions = (m.institutions ?? [])
        .map((i) => i.value)
        .filter(Boolean)
        .join(", ");
      const description = stripHtml(m.description ?? "").slice(0, 4000);
      const categories = m.arxiv_categories ?? [];

      // Keep astronomy-tagged listings, close neighbours (gravitation), and
      // anything whose wording is clearly astronomy / astrophysics.
      const tagged = categories.some((c) => /^(astro-ph|gr-qc)/i.test(c));
      const keyworded = ASTRO_KEYWORDS.some((k) =>
        `${title} ${description}`.toLowerCase().includes(k),
      );
      if (!tagged && !keyworded) continue;

      const region = m.regions?.[0] ?? null;
      const externalUrl = m.urls?.[0]?.value;

      items.push({
        source,
        external_id: id,
        kind: "position",
        title,
        organisation: institutions || null,
        country:
          guessCountry(`${institutions} ${description}`) ??
          (region === "Europe" ? "Europe-wide" : region),
        location: institutions || region,
        summary: description.slice(0, 320) || `Postdoctoral position — ${institutions}`,
        description,
        url: externalUrl ?? `https://inspirehep.net/jobs/${id}`,
        deadline: m.deadline_date ? new Date(`${m.deadline_date}T00:00:00Z`).toISOString() : null,
        published_at: null,
        funding: null,
        status: m.status === "open" ? "Open" : (m.status ?? null),
        tags: ["Postdoc position", region ?? "Worldwide", ...categories.slice(0, 3)].filter(
          Boolean,
        ),
      });
    }
    return { source, ok: true, message: null, items };
  } catch (e) {
    return {
      source,
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      items: [],
    };
  }
}

/* ------------------------------------------------------------------ */
/* Institutional RSS feeds                                             */
/* ------------------------------------------------------------------ */

const RSS_SOURCES: Array<{ source: string; url: string; kind: "grant" | "position" }> = [
  { source: "eso-announcements", url: "https://www.eso.org/public/announcements/feed/", kind: "grant" },
];

export async function fetchGenericRss(): Promise<SourceResult[]> {
  return Promise.all(
    RSS_SOURCES.map(async ({ source, url, kind }) => {
      try {
        const res = await fetch(url, {
          headers: { accept: "application/rss+xml, application/xml, text/xml, */*" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        const items = parseRssItems(xml)
          .filter(
            (it) =>
              it.title &&
              it.link &&
              /fellow|postdoc|studentship|vacanc|position|call for/i.test(
                `${it.title} ${it.description}`,
              ),
          )
          .map<NormalizedItem>((it) => ({
            source,
            external_id: it.guid || it.link,
            kind,
            title: it.title,
            organisation: "European Southern Observatory",
            country: guessCountry(`${it.title} ${it.description}`) ?? "Europe-wide",
            location: null,
            summary: it.description.slice(0, 320),
            description: it.description.slice(0, 4000),
            url: it.link,
            deadline: null,
            published_at: it.pubDate ? new Date(it.pubDate).toISOString() : null,
            funding: null,
            status: "Open",
            tags: ["ESO"],
          }));
        return { source, ok: true, message: null, items };
      } catch (e) {
        return {
          source,
          ok: false,
          message: e instanceof Error ? e.message : "Unknown error",
          items: [],
        };
      }
    }),
  );
}

/* ------------------------------------------------------------------ */
/* ESO recruitment portal (fellowships, studentships, staff astronomers)*/
/* ------------------------------------------------------------------ */

const SCHEME_RE =
  /fellow|postdoc|post-doc|studentship|astronom|scientist|research associate|call for (proposals|applications)|grant/i;

export async function fetchEsoRecruitment(): Promise<SourceResult> {
  const source = "eso-recruitment";
  try {
    const res = await fetch("https://jobs.eso.org/jobs.rss", {
      headers: { accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRssItems(xml)
      .filter((it) => it.title && it.link && SCHEME_RE.test(`${it.title} ${it.description}`))
      .map<NormalizedItem>((it) => ({
        source,
        external_id: it.guid || it.link,
        kind: /fellow|grant|call for/i.test(it.title) ? "grant" : "position",
        title: it.title,
        organisation: "European Southern Observatory (ESO)",
        country: guessCountry(`${it.title} ${it.description}`) ?? "Germany",
        location: "Garching, Germany / Chile",
        summary: it.description.slice(0, 320) || `ESO opening — ${it.title}`,
        description: it.description.slice(0, 4000),
        url: it.link,
        deadline: null,
        published_at: it.pubDate ? new Date(it.pubDate).toISOString() : null,
        funding: null,
        status: "Open",
        tags: ["ESO", "Fellowship scheme"],
      }));
    return { source, ok: true, message: null, items };
  } catch (e) {
    return { source, ok: false, message: e instanceof Error ? e.message : "Unknown error", items: [] };
  }
}

/* ------------------------------------------------------------------ */
/* SAP SuccessFactors career portals (ESA, DLR)                        */
/* ------------------------------------------------------------------ */

const ESA_QUERIES = ["research+fellow", "fellowship", "science", "astronom"];

export async function fetchEsaCareers(): Promise<SourceResult> {
  const source = "esa-careers";
  const byId = new Map<string, NormalizedItem>();
  try {
    for (const q of ESA_QUERIES) {
      const res = await fetch(`https://jobs.esa.int/search/?q=${q}`, {
        headers: { accept: "text/html", "user-agent": "Mozilla/5.0 (compatible; AstroGrants/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const matches = html.matchAll(
        /class="jobTitle-link[^"]*"[^>]*href="(\/job\/([^"/]+)\/(\d+)\/?)"[^>]*>([\s\S]*?)<\/a>/g,
      );
      for (const m of matches) {
        const path = m[1];
        const id = m[3];
        const title = stripHtml(m[4] ?? "");
        if (!path || !id || !title) continue;
        if (!SCHEME_RE.test(title)) continue;
        const slug = decodeURIComponent(m[2] ?? "").replace(/-/g, " ");
        byId.set(id, {
          source,
          external_id: id,
          kind: /fellow/i.test(title) ? "grant" : "position",
          title,
          organisation: "European Space Agency (ESA)",
          country: guessCountry(slug) ?? "Europe-wide",
          location: slug.split(" ").slice(0, 2).join(" "),
          summary: `ESA opening — ${title}`,
          description: null,
          url: `https://jobs.esa.int${path}`,
          deadline: null,
          published_at: null,
          funding: null,
          status: "Open",
          tags: ["ESA", "Space agency"],
        });
      }
    }
    return { source, ok: true, message: null, items: [...byId.values()] };
  } catch (e) {
    return {
      source,
      ok: false,
      message: e instanceof Error ? e.message : "Unknown error",
      items: [...byId.values()],
    };
  }
}

export async function fetchDlrJobs(): Promise<SourceResult> {
  const source = "dlr-jobs";
  try {
    const res = await fetch("https://jobs.dlr.de/services/rss/category/?catid=9261201", {
      headers: { accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRssItems(xml)
      .filter((it) => {
        const text = `${it.title} ${it.description}`.toLowerCase();
        const astro =
          ASTRO_KEYWORDS.some((k) => text.includes(k)) ||
          /astronom|astrophys|weltraum|raumfahrt|sternwarte|planetenforschung/.test(text);
        return it.title && it.link && astro && SCHEME_RE.test(`${it.title} ${it.description}`);
      })
      .map<NormalizedItem>((it) => ({
        source,
        external_id: it.guid || it.link,
        kind: "position",
        title: it.title,
        organisation: "German Aerospace Center (DLR)",
        country: "Germany",
        location: "Germany",
        summary: it.description.slice(0, 320),
        description: it.description.slice(0, 4000),
        url: it.link,
        deadline: null,
        published_at: it.pubDate ? new Date(it.pubDate).toISOString() : null,
        funding: null,
        status: "Open",
        tags: ["DLR", "Space agency"],
      }));
    return { source, ok: true, message: null, items };
  } catch (e) {
    return { source, ok: false, message: e instanceof Error ? e.message : "Unknown error", items: [] };
  }
}

/* ------------------------------------------------------------------ */
/* AAS Job Register — postdoctoral positions & fellowships             */
/* (Cloudflare-protected, read through the Firecrawl connector)        */
/* ------------------------------------------------------------------ */

const AAS_URL = "https://aas.org/jobregister?f%5B0%5D=category%3A511";

function cleanCell(cell: string): string {
  return stripHtml(cell.replace(/<br\s*\/?>/gi, ", "))
    .replace(/,\s*-\s+/g, "; ")
    .replace(/\s*,\s*,+/g, ", ")
    .replace(/^[-,\s]+|[-,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAasDate(value: string): string | null {
  const m = value.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).toISOString();
}

export async function fetchAasJobRegister(): Promise<SourceResult> {
  const source = "aas-jobregister";
  try {
    const firecrawlKey = process.env["FIRECRAWL_API_KEY"];
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${firecrawlKey}`,
      },
      body: JSON.stringify({ url: AAS_URL, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      markdown?: string;
      data?: { markdown?: string };
    };
    const markdown = json.markdown ?? json.data?.markdown ?? "";
    if (!markdown) throw new Error("Empty response");

    const items: NormalizedItem[] = [];
    const rowRe =
      /^\|\s*\[([^\]]+)\]\((https:\/\/aas\.org\/jobregister\/ad\/([a-z0-9]+))\)\s*\|([^|]*)\|([\s\S]*?)\|([^|]*)\|([^|]*)\|\s*$/gim;
    for (const m of markdown.matchAll(rowRe)) {
      const title = cleanCell(m[1] ?? "");
      const url = m[2] ?? "";
      const id = m[3] ?? "";
      const organisation = cleanCell(m[4] ?? "");
      const location = cleanCell(m[5] ?? "");
      const published = parseAasDate(m[6] ?? "");
      const deadline = parseAasDate(m[7] ?? "");
      if (!title || !id) continue;
      if (deadline && new Date(deadline).getTime() < Date.now()) continue;

      const isFellowship = /fellowship|fellow\b|programme|program\b/i.test(title);
      items.push({
        source,
        external_id: id,
        kind: isFellowship ? "grant" : "position",
        title,
        organisation: organisation || null,
        country:
          guessCountry(location) ??
          (location.split(/[;,]/).pop()?.trim() || null),
        location: location || null,
        summary: `${isFellowship ? "Fellowship" : "Postdoctoral position"}${
          organisation ? ` — ${organisation}` : ""
        }${location ? `, ${location}` : ""}`,
        description: null,
        url,
        deadline,
        published_at: published,
        funding: null,
        status: "Open",
        tags: ["AAS Job Register", isFellowship ? "Fellowship" : "Postdoc position"],
      });
    }
    if (items.length === 0) throw new Error("No listings parsed");
    return { source, ok: true, message: null, items };
  } catch (e) {
    return { source, ok: false, message: e instanceof Error ? e.message : "Unknown error", items: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Worldwide job boards                                                */
/* ------------------------------------------------------------------ */

const UA = { "user-agent": "Mozilla/5.0 (compatible; AstroRadar/1.0)" };
const POSTDOC_RE = /postdoc|post-doc|fellow|research associate|research scientist|research fellow/i;
const ASTRO_RE =
  /astro|cosmolog|galax|exoplanet|planetary|stellar|gravitational|telescope|observator|black hole|dark matter|space science|heliophys|solar/i;
const regionName = new Intl.DisplayNames(["en"], { type: "region" });

function failed(source: string, e: unknown): SourceResult {
  return { source, ok: false, message: e instanceof Error ? e.message : "Unknown error", items: [] };
}

function isoOrNull(value: string): string | null {
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Academic Jobs Online — RSS of every open ad, with structured ads:* fields. */
export async function fetchAcademicJobsOnline(): Promise<SourceResult> {
  const source = "academic-jobs-online";
  try {
    const res = await fetch("https://academicjobsonline.org/ajo?joblist-0-0-0-----rss--", {
      headers: UA,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseRssItems(await res.text())
      .filter((it) => {
        const text = `${it.title} ${it.get("ads:Disciplines")} ${it.get("ads:Dept")} ${it.description}`;
        return it.link && ASTRO_RE.test(text) && POSTDOC_RE.test(`${it.title} ${it.description}`);
      })
      .map<NormalizedItem>((it) => {
        const code = it.get("ads:Country");
        const country = code ? (regionName.of(code) ?? code) : null;
        const city = it.get("ads:City");
        return {
          source,
          external_id: it.get("ads:ID") || it.link,
          kind: /fellow/i.test(it.title) ? "grant" : "position",
          title: it.title,
          organisation: it.get("dc:creator") || it.get("ads:Univ") || null,
          country,
          location: [city, country].filter(Boolean).join(", ") || null,
          summary: it.description.slice(0, 320),
          description: it.description.slice(0, 4000),
          url: it.link.replace(/\?rss$/, ""),
          deadline: isoOrNull(it.get("ads:Deadline")),
          published_at: isoOrNull(it.get("ads:PostDate")),
          funding: null,
          status: "Open",
          tags: ["AJO", it.get("ads:Disciplines")].filter(Boolean),
        };
      });
    return { source, ok: true, message: null, items };
  } catch (e) {
    return failed(source, e);
  }
}

/** Madgex job boards (Physics Today, Nature Careers, Science Careers) share one RSS format. */
const MADGEX_BOARDS = [
  { source: "physics-today", url: "https://jobs.physicstoday.org/jobsrss/?keywords=astronomy", tag: "Physics Today" },
  { source: "physics-today", url: "https://jobs.physicstoday.org/jobsrss/?keywords=astrophysics", tag: "Physics Today" },
  { source: "nature-careers", url: "https://www.nature.com/naturecareers/jobsrss/?keywords=astrophysics", tag: "Nature Careers" },
  { source: "nature-careers", url: "https://www.nature.com/naturecareers/jobsrss/?keywords=astronomy", tag: "Nature Careers" },
  { source: "science-careers", url: "https://jobs.sciencecareers.org/jobsrss/?keywords=astrophysics", tag: "Science Careers" },
  { source: "science-careers", url: "https://jobs.sciencecareers.org/jobsrss/?keywords=astronomy", tag: "Science Careers" },
];

export async function fetchMadgexBoards(): Promise<SourceResult[]> {
  const bySource = new Map<string, SourceResult>();
  await Promise.all(
    MADGEX_BOARDS.map(async ({ source, url, tag }) => {
      const result = bySource.get(source) ?? { source, ok: true, message: null, items: [] };
      bySource.set(source, result);
      try {
        const res = await fetch(url, { headers: UA });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        for (const it of parseRssItems(await res.text())) {
          // Title is "Employer: Job title"
          const cut = it.title.indexOf(": ");
          const employer = cut > 0 ? it.title.slice(0, cut).trim() : null;
          const title = cut > 0 ? it.title.slice(cut + 2).trim() : it.title;
          if (!it.link || !POSTDOC_RE.test(title)) continue;
          if (!ASTRO_RE.test(it.title)) continue; // title includes the employer/department
          const id = it.link.match(/\/job\/(\d+)/)?.[1] ?? it.link;
          if (result.items.some((x) => x.external_id === id)) continue;
          result.items.push({
            source,
            external_id: id,
            kind: /fellow/i.test(title) ? "grant" : "position",
            title,
            organisation: employer,
            country: guessCountry(it.description),
            location: null,
            summary: it.description.slice(0, 320),
            description: it.description.slice(0, 4000),
            url: it.link.split("?")[0] ?? it.link,
            deadline: null,
            published_at: isoOrNull(it.pubDate),
            funding: null,
            status: "Open",
            tags: [tag],
          });
        }
      } catch (e) {
        result.ok = false;
        result.message = e instanceof Error ? e.message : "Unknown error";
      }
    }),
  );
  return [...bySource.values()];
}

/** "30 Nov" (no year) -> next occurrence of that date. */
function nextDayMonth(value: string): string | null {
  const now = new Date();
  const d = new Date(`${value} ${now.getUTCFullYear()} 23:59:00 UTC`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() < now.getTime() - 86_400_000) d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/** jobs.ac.uk — UK academic jobs, parsed from the search results page. */
export async function fetchJobsAcUk(): Promise<SourceResult> {
  const source = "jobs-ac-uk";
  const byId = new Map<string, NormalizedItem>();
  try {
    for (const q of ["astrophysics", "astronomy", "cosmology"]) {
      const res = await fetch(`https://www.jobs.ac.uk/search/?keywords=${q}`, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blocks = (await res.text()).split('class="j-search-result__result').slice(1);
      for (const b of blocks) {
        const link = b.match(/href="(\/job\/([A-Z0-9]+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
        if (!link?.[1] || !link[2]) continue;
        const title = stripHtml(link[3] ?? "");
        if (!POSTDOC_RE.test(title)) continue;
        const field = (cls: string) => {
          const m = b.match(new RegExp(`class="j-search-result__${cls}"[^>]*>([\\s\\S]*?)</div>`));
          return m?.[1] ? stripHtml(m[1]) : null;
        };
        const location = b.match(/Location:\s*([^<]*)/)?.[1]?.trim() || null;
        const closes = b.match(/date--blue[^>]*>([^<]*)</)?.[1]?.trim() ?? "";
        byId.set(link[2], {
          source,
          external_id: link[2],
          kind: /fellow/i.test(title) ? "grant" : "position",
          title,
          organisation: field("employer"),
          country: "United Kingdom",
          location,
          summary: [field("department"), field("employer"), location].filter(Boolean).join(" · "),
          description: null,
          url: `https://www.jobs.ac.uk${link[1]}`,
          deadline: closes ? nextDayMonth(closes) : null,
          published_at: null,
          funding: null,
          status: "Open",
          tags: ["jobs.ac.uk"],
        });
      }
    }
    return { source, ok: true, message: null, items: [...byId.values()] };
  } catch (e) {
    return { ...failed(source, e), items: [...byId.values()] };
  }
}

/** European Astronomical Society job directory (all astronomy). */
export async function fetchEasJobs(): Promise<SourceResult> {
  const source = "eas-jobs";
  try {
    const res = await fetch("https://eas.unige.ch/jobs.jsp", { headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const items: NormalizedItem[] = [];
    for (const b of html.split('<table class="job"').slice(1)) {
      const title = stripHtml(b.match(/<td class="title">([\s\S]*?)<\/td>/)?.[1] ?? "");
      const abstractHtml = b.match(/<td class="abstract"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? "";
      const abstract = stripHtml(abstractHtml);
      const closing = b.match(/Closing date:[\s\S]*?(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
      if (!title || !POSTDOC_RE.test(`${title} ${abstract}`)) continue;
      const link = abstractHtml.match(/href="(https?:\/\/[^"]+)"/)?.[1] ?? "https://eas.unige.ch/jobs.jsp";
      items.push({
        source,
        external_id: `${title}|${closing ?? ""}`.slice(0, 200),
        kind: /fellow/i.test(title) ? "grant" : "position",
        title,
        organisation: null,
        country: guessCountry(`${title} ${abstract}`),
        location: null,
        summary: abstract.slice(0, 320),
        description: abstract.slice(0, 4000),
        url: link,
        deadline: closing ? `${closing}T23:59:00Z` : null,
        published_at: null,
        funding: null,
        status: "Open",
        tags: ["EAS"],
      });
    }
    return { source, ok: true, message: null, items };
  } catch (e) {
    return failed(source, e);
  }
}

export async function collectAllSources(): Promise<SourceResult[]> {
  const [eu, inspire, eso, esa, dlr, aas, rest, ajo, madgex, jobsAcUk, eas] = await Promise.all([
    fetchEuPortal(),
    fetchInspireJobs(),
    fetchEsoRecruitment(),
    fetchEsaCareers(),
    fetchDlrJobs(),
    fetchAasJobRegister(),
    fetchGenericRss(),
    fetchAcademicJobsOnline(),
    fetchMadgexBoards(),
    fetchJobsAcUk(),
    fetchEasJobs(),
  ]);
  return [eu, inspire, eso, esa, dlr, aas, ...rest, ajo, ...madgex, jobsAcUk, eas];
}

