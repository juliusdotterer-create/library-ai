CREATE OR REPLACE FUNCTION public.is_whitelisted()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails ae
    WHERE lower(ae.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND coalesce(auth.jwt() ->> 'email', '') <> ''
  ) OR private.has_role(auth.uid(), 'admin'::app_role)
$$;

REVOKE ALL ON FUNCTION public.is_whitelisted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_whitelisted() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_whitelisted() TO service_role;