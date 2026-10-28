CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS documents_name_trgm ON public.documents USING gin (lower(name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS folders_name_trgm ON public.folders USING gin (lower(name) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_library_fuzzy(term text, max_results int DEFAULT 20)
RETURNS TABLE(kind text, id uuid, name text, score real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, extensions
AS $$
  (SELECT 'doc'::text, d.id, d.name, extensions.word_similarity(lower(term), lower(d.name)) AS score
     FROM public.documents d
    WHERE d.user_id = auth.uid() AND d.deleted_at IS NULL
      AND extensions.word_similarity(lower(term), lower(d.name)) > 0.4
    ORDER BY score DESC LIMIT max_results)
  UNION ALL
  (SELECT 'folder'::text, f.id, f.name, extensions.word_similarity(lower(term), lower(f.name)) AS score
     FROM public.folders f
    WHERE f.user_id = auth.uid() AND f.deleted_at IS NULL
      AND extensions.word_similarity(lower(term), lower(f.name)) > 0.4
    ORDER BY score DESC LIMIT max_results)
$$;
GRANT EXECUTE ON FUNCTION public.search_library_fuzzy(text, int) TO authenticated;