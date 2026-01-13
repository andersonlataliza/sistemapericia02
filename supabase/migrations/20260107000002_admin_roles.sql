-- =====================================================
-- MIGRATION: Admin roles + multi-admin support
-- Created: 2026-01-07
-- =====================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (email);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admins can read admin_users'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can read admin_users" ON public.admin_users FOR SELECT USING (public.is_admin() OR auth.uid() = user_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admins can insert admin_users'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can insert admin_users" ON public.admin_users FOR INSERT WITH CHECK (public.is_admin())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND policyname = 'Admins can delete admin_users'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete admin_users" ON public.admin_users FOR DELETE USING (public.is_admin())';
  END IF;
END $$;

INSERT INTO public.admin_users (user_id, email, created_by)
SELECT u.id, u.email, u.id
FROM auth.users u
WHERE lower(u.email) = 'anderson.lataliza@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all processes" ON public.processes;
DROP POLICY IF EXISTS "Admin can update all processes" ON public.processes;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can view all profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update all profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin()) WITH CHECK (TRUE)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'processes'
      AND policyname = 'Admins can view all processes'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all processes" ON public.processes FOR SELECT USING (public.is_admin())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'processes'
      AND policyname = 'Admins can update all processes'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can update all processes" ON public.processes FOR UPDATE USING (public.is_admin()) WITH CHECK (TRUE)';
  END IF;
END $$;
