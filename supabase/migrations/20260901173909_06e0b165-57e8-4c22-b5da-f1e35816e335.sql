CREATE INDEX IF NOT EXISTS events_user_start_idx ON public.events (user_id, start_at);
CREATE INDEX IF NOT EXISTS links_user_pos_idx ON public.links (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS study_plans_user_idx ON public.study_plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS study_tasks_plan_idx ON public.study_tasks (user_id, plan_id, due_date);
CREATE INDEX IF NOT EXISTS timetable_entries_user_idx ON public.timetable_entries (user_id, weekday, start_time);
CREATE INDEX IF NOT EXISTS documents_user_deleted_idx ON public.documents (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS folders_user_deleted_idx ON public.folders (user_id, deleted_at);