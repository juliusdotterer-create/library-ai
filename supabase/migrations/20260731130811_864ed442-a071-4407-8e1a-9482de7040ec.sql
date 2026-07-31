-- Lock down SECURITY DEFINER / trigger functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.ensure_owner_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_email_allowed(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- Only signed-in users may call these app-facing helpers
GRANT EXECUTE ON FUNCTION public.ensure_owner_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Explicit admin-only role management on user_roles
CREATE POLICY "admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;