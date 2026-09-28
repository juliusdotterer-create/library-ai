CREATE TABLE public.drive_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  page_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_sync_state TO authenticated;
GRANT ALL ON public.drive_sync_state TO service_role;
ALTER TABLE public.drive_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sync state" ON public.drive_sync_state FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS documents_user_external_idx ON public.documents (user_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS folders_user_external_idx ON public.folders (user_id, external_id) WHERE external_id IS NOT NULL;