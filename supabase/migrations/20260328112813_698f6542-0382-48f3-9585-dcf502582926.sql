
-- Create user roles system
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Only admins can read roles
CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No one can self-assign roles (only via service role / migration)
CREATE POLICY "No public insert"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "No public update"
ON public.user_roles FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No public delete"
ON public.user_roles FOR DELETE TO authenticated
USING (false);

-- Seed current admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'aronleijon@icloud.com'
ON CONFLICT DO NOTHING;
