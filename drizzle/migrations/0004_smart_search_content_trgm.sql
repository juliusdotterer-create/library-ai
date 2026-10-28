CREATE INDEX IF NOT EXISTS document_text_content_trgm ON public.document_text USING gin (lower(content) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_library_fuzzy(term text, max_results int DEFAULT 20)
RETURNS TABLE(kind text, id uuid, name text, score real)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, extensions
AS $$
BEGIN
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);
  RETURN QUERY
  (SELECT 'doc'::text, d.id, d.name, extensions.word_similarity(lower(term), lower(d.name))
     FROM public.documents d
    WHERE d.user_id = auth.uid() AND d.deleted_at IS NULL
      AND lower(term) <% lower(d.name)
    ORDER BY 4 DESC LIMIT max_results)
  UNION ALL
  (SELECT 'folder'::text, f.id, f.name, extensions.word_similarity(lower(term), lower(f.name))
     FROM public.folders f
    WHERE f.user_id = auth.uid() AND f.deleted_at IS NULL
      AND lower(term) <% lower(f.name)
    ORDER BY 4 DESC LIMIT max_results)
  UNION ALL
  (SELECT 'content'::text, t.document_id, ''::text, 0.5::real
     FROM public.document_text t
    WHERE t.user_id = auth.uid() AND t.status = 'done'
      AND lower(term) <% lower(t.content)
    LIMIT max_results);
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_library_fuzzy(text, int) TO authenticated;