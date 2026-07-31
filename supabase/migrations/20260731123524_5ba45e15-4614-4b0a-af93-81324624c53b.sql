-- roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- whitelist
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage whitelist" ON public.allowed_emails;
CREATE POLICY "admins manage whitelist" ON public.allowed_emails FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS allowed_emails_updated_at ON public.allowed_emails;
CREATE TRIGGER allowed_emails_updated_at BEFORE UPDATE ON public.allowed_emails
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.allowed_emails (email, note)
VALUES ('julius.dotterer@gmail.com', 'Eigentümer')
ON CONFLICT (email) DO NOTHING;

-- check function usable by any signed-in user for their own email
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(_email))
$$;
GRANT EXECUTE ON FUNCTION public.is_email_allowed(text) TO authenticated, anon;

-- self-service admin bootstrap for the owner address
CREATE OR REPLACE FUNCTION public.ensure_owner_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  SELECT lower(coalesce(auth.jwt() ->> 'email','')) INTO _email;
  IF _email = 'julius.dotterer@gmail.com' AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(),'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_owner_admin() TO authenticated;