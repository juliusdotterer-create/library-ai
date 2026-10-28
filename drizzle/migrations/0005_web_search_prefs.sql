CREATE TABLE public.web_search_prefs (
  user_id uuid PRIMARY KEY,
  scope text NOT NULL DEFAULT 'prefer_legal',
  disabled_domains text[] NOT NULL DEFAULT '{}',
  custom_domains text[] NOT NULL DEFAULT '{}',
  blocked_domains text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_search_prefs TO authenticated;
GRANT ALL ON public.web_search_prefs TO service_role;
ALTER TABLE public.web_search_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs select" ON public.web_search_prefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs insert" ON public.web_search_prefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.web_search_prefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs delete" ON public.web_search_prefs FOR DELETE TO authenticated USING (auth.uid() = user_id);