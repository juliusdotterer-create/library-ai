CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  reconnect_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER app_user_connections_updated_at BEFORE UPDATE ON public.app_user_connections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.documents
  ADD COLUMN source text NOT NULL DEFAULT 'local',
  ADD COLUMN external_id text,
  ADD COLUMN external_mime text,
  ADD COLUMN external_modified timestamptz,
  ADD COLUMN drive_state text NOT NULL DEFAULT 'ok';

ALTER TABLE public.folders
  ADD COLUMN source text NOT NULL DEFAULT 'local',
  ADD COLUMN external_id text;

CREATE INDEX documents_user_source_idx ON public.documents (user_id, source);
CREATE UNIQUE INDEX documents_drive_unique ON public.documents (user_id, external_id) WHERE source = 'gdrive' AND external_id IS NOT NULL;
CREATE UNIQUE INDEX folders_drive_unique ON public.folders (user_id, external_id) WHERE source = 'gdrive' AND external_id IS NOT NULL;