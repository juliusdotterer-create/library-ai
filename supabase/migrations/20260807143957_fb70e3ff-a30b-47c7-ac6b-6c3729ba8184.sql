ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS notebook_id uuid REFERENCES public.notebooks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS documents_notebook_id_idx ON public.documents(notebook_id);

ALTER TABLE public.documents ALTER COLUMN storage_path SET DEFAULT '';