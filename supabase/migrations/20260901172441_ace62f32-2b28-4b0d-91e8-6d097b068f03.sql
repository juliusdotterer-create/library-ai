CREATE TABLE public.web_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_frames TO authenticated;
GRANT ALL ON public.web_frames TO service_role;
ALTER TABLE public.web_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "web_frames_select" ON public.web_frames FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "web_frames_insert" ON public.web_frames FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "web_frames_update" ON public.web_frames FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "web_frames_delete" ON public.web_frames FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX web_frames_user_pos_idx ON public.web_frames (user_id, position);