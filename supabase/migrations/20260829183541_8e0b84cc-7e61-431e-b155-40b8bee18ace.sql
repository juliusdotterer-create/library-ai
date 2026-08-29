ALTER TABLE public.document_text
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS document_text_status_idx ON public.document_text (user_id, status);