-- =====================================================
-- MIGRATION: Admin user management + user blocking
-- Created: 2026-01-07
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admin can view all profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT USING (lower(auth.jwt() ->> ''email'') = ''anderson.lataliza@gmail.com'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admin can update all profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE USING (lower(auth.jwt() ->> ''email'') = ''anderson.lataliza@gmail.com'') WITH CHECK (TRUE)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'processes'
      AND policyname = 'Admin can view all processes'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can view all processes" ON public.processes FOR SELECT USING (lower(auth.jwt() ->> ''email'') = ''anderson.lataliza@gmail.com'')';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'processes'
      AND policyname = 'Admin can update all processes'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can update all processes" ON public.processes FOR UPDATE USING (lower(auth.jwt() ->> ''email'') = ''anderson.lataliza@gmail.com'') WITH CHECK (TRUE)';
  END IF;
END $$;
