CREATE TABLE public.document_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_annotations TO authenticated;
GRANT ALL ON public.document_annotations TO service_role;
ALTER TABLE public.document_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own annotations" ON public.document_annotations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER document_annotations_updated_at BEFORE UPDATE ON public.document_annotations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.document_notepads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_notepads TO authenticated;
GRANT ALL ON public.document_notepads TO service_role;
ALTER TABLE public.document_notepads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notepads" ON public.document_notepads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER document_notepads_updated_at BEFORE UPDATE ON public.document_notepads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();