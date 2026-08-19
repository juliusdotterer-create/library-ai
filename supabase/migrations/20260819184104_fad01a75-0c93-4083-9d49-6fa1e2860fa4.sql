CREATE TABLE public.document_text (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  page_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('german', coalesce(content, ''))) STORED,
  CONSTRAINT document_text_document_unique UNIQUE (document_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_text TO authenticated;
GRANT ALL ON public.document_text TO service_role;

ALTER TABLE public.document_text ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own document text" ON public.document_text
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX document_text_tsv_idx ON public.document_text USING gin (tsv);
CREATE INDEX document_text_user_idx ON public.document_text (user_id);

CREATE TRIGGER document_text_updated_at
  BEFORE UPDATE ON public.document_text
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();