CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  kind text NOT NULL DEFAULT 'grant',
  title text NOT NULL,
  organisation text,
  country text,
  location text,
  summary text,
  description text,
  url text NOT NULL,
  deadline timestamptz,
  published_at timestamptz,
  funding text,
  status text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Opportunities are publicly readable"
ON public.opportunities FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX opportunities_deadline_idx ON public.opportunities (deadline);
CREATE INDEX opportunities_kind_idx ON public.opportunities (kind);

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites select"
ON public.favorites FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users manage own favorites insert"
ON public.favorites FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own favorites delete"
ON public.favorites FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  ok boolean NOT NULL,
  message text,
  items_found integer NOT NULL DEFAULT 0,
  ran_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.source_runs TO anon;
GRANT SELECT ON public.source_runs TO authenticated;
GRANT ALL ON public.source_runs TO service_role;

ALTER TABLE public.source_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Source runs are publicly readable"
ON public.source_runs FOR SELECT TO anon, authenticated
USING (true);