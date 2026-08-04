ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Neues Notizbuch',
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebooks TO authenticated;
GRANT ALL ON public.notebooks TO service_role;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notebooks" ON public.notebooks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notebooks_updated BEFORE UPDATE ON public.notebooks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.notebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  strokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notebook_pages_notebook_idx ON public.notebook_pages(notebook_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_pages TO authenticated;
GRANT ALL ON public.notebook_pages TO service_role;
ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notebook pages" ON public.notebook_pages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER notebook_pages_updated BEFORE UPDATE ON public.notebook_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();