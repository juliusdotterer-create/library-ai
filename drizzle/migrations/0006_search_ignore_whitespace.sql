CREATE OR REPLACE FUNCTION public.search_compact(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = public
AS $$ SELECT regexp_replace(lower(value), '[[:space:]§]+', '', 'g') $$;
CREATE INDEX IF NOT EXISTS documents_name_compact_trgm ON public.documents USING gin (public.search_compact(name) extensions.gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS folders_name_compact_trgm ON public.folders USING gin (public.search_compact(name) extensions.gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS document_text_compact_trgm ON public.document_text USING gin (public.search_compact(content) extensions.gin_trgm_ops) WHERE status = 'done';
CREATE OR REPLACE FUNCTION public.search_library_compact(term text, max_results integer DEFAULT 100)
RETURNS TABLE(kind text, id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
WITH needle AS (SELECT '%' || replace(replace(replace(public.search_compact(left(term, 200)), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' AS pattern WHERE length(public.search_compact(term)) >= 2)
(SELECT 'doc'::text, d.id FROM public.documents d, needle n WHERE d.user_id = auth.uid() AND d.deleted_at IS NULL AND public.search_compact(d.name) LIKE n.pattern ORDER BY d.id LIMIT least(greatest(max_results, 1), 150))
UNION ALL
(SELECT 'folder'::text, f.id FROM public.folders f, needle n WHERE f.user_id = auth.uid() AND f.deleted_at IS NULL AND public.search_compact(f.name) LIKE n.pattern ORDER BY f.id LIMIT least(greatest(max_results, 1), 150))
UNION ALL
(SELECT 'content'::text, t.document_id FROM public.document_text t, needle n WHERE t.user_id = auth.uid() AND t.status = 'done' AND public.search_compact(t.content) LIKE n.pattern ORDER BY t.document_id LIMIT least(greatest(max_results, 1), 150))
$$;
REVOKE ALL ON FUNCTION public.search_library_compact(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_library_compact(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_compact(text) TO authenticated;