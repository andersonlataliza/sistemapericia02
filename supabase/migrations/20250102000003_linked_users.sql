-- =====================================================
-- MIGRATION: Linked Users System
-- Created: 2025-01-02
-- Description: Sistema de usuários vinculados por CPF para visualização de processos
-- =====================================================

-- =====================================================
-- 1. LINKED USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.linked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_cpf TEXT NOT NULL,
  linked_user_name TEXT NOT NULL,
  linked_user_email TEXT,
  linked_user_phone TEXT,
  permissions JSONB DEFAULT '{"view_processes": true, "view_documents": false, "view_reports": false}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_owner_cpf UNIQUE (owner_user_id, linked_user_cpf),
  CONSTRAINT valid_cpf_format CHECK (linked_user_cpf ~ '^[0-9]{11}$')
);

-- =====================================================
-- 2. PROCESS ACCESS TABLE (Many-to-Many)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.process_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  linked_user_id UUID NOT NULL REFERENCES public.linked_users(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_process_linked_user UNIQUE (process_id, linked_user_id)
);

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_linked_users_owner ON public.linked_users(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_linked_users_cpf ON public.linked_users(linked_user_cpf);
CREATE INDEX IF NOT EXISTS idx_linked_users_status ON public.linked_users(status);
CREATE INDEX IF NOT EXISTS idx_process_access_process ON public.process_access(process_id);
CREATE INDEX IF NOT EXISTS idx_process_access_linked_user ON public.process_access(linked_user_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.linked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_access ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. RLS POLICIES FOR LINKED_USERS
-- =====================================================

-- Users can view their own linked users
DROP POLICY IF EXISTS "Users can view own linked users" ON public.linked_users;
CREATE POLICY "Users can view own linked users" ON public.linked_users
  FOR SELECT USING (owner_user_id = auth.uid());

-- Users can insert their own linked users
DROP POLICY IF EXISTS "Users can insert own linked users" ON public.linked_users;
CREATE POLICY "Users can insert own linked users" ON public.linked_users
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Users can update their own linked users
DROP POLICY IF EXISTS "Users can update own linked users" ON public.linked_users;
CREATE POLICY "Users can update own linked users" ON public.linked_users
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Users can delete their own linked users
DROP POLICY IF EXISTS "Users can delete own linked users" ON public.linked_users;
CREATE POLICY "Users can delete own linked users" ON public.linked_users
  FOR DELETE USING (owner_user_id = auth.uid());

-- =====================================================
-- 6. RLS POLICIES FOR PROCESS_ACCESS
-- =====================================================

-- Users can view process access for their own processes
DROP POLICY IF EXISTS "Users can view process access for own processes" ON public.process_access;
CREATE POLICY "Users can view process access for own processes" ON public.process_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = process_access.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- Users can grant access to their own processes
DROP POLICY IF EXISTS "Users can grant access to own processes" ON public.process_access;
CREATE POLICY "Users can grant access to own processes" ON public.process_access
  FOR INSERT WITH CHECK (
    granted_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = process_access.process_id 
      AND processes.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.linked_users 
      WHERE linked_users.id = process_access.linked_user_id 
      AND linked_users.owner_user_id = auth.uid()
    )
  );

-- Users can update process access for their own processes
DROP POLICY IF EXISTS "Users can update process access for own processes" ON public.process_access;
CREATE POLICY "Users can update process access for own processes" ON public.process_access
  FOR UPDATE USING (
    granted_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = process_access.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- Users can delete process access for their own processes
DROP POLICY IF EXISTS "Users can delete process access for own processes" ON public.process_access;
CREATE POLICY "Users can delete process access for own processes" ON public.process_access
  FOR DELETE USING (
    granted_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = process_access.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- =====================================================
-- 7. UPDATED_AT TRIGGERS
-- =====================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to linked_users
DROP TRIGGER IF EXISTS handle_linked_users_updated_at ON public.linked_users;
CREATE TRIGGER handle_linked_users_updated_at
  BEFORE UPDATE ON public.linked_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 8. HELPER FUNCTIONS
-- =====================================================

-- Function to get processes accessible by a CPF
CREATE OR REPLACE FUNCTION public.get_processes_by_cpf(user_cpf TEXT)
RETURNS TABLE (
  process_id UUID,
  process_number TEXT,
  claimant_name TEXT,
  defendant_name TEXT,
  court TEXT,
  status TEXT,
  inspection_date TIMESTAMPTZ,
  owner_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as process_id,
    p.process_number,
    p.claimant_name,
    p.defendant_name,
    p.court,
    p.status,
    p.inspection_date,
    prof.full_name as owner_name
  FROM public.processes p
  INNER JOIN public.process_access pa ON p.id = pa.process_id
  INNER JOIN public.linked_users lu ON pa.linked_user_id = lu.id
  INNER JOIN public.profiles prof ON p.user_id = prof.id
  WHERE lu.linked_user_cpf = user_cpf
    AND lu.status = 'active'
    AND p.status IN ('active', 'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate CPF format
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  cpf TEXT;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  digit1 INTEGER;
  digit2 INTEGER;
  i INTEGER;
BEGIN
  -- Remove non-numeric characters
  cpf := regexp_replace(cpf_input, '[^0-9]', '', 'g');
  
  -- Check if CPF has 11 digits
  IF length(cpf) != 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Check for known invalid CPFs (all same digits)
  IF cpf IN ('00000000000', '11111111111', '22222222222', '33333333333', 
             '44444444444', '55555555555', '66666666666', '77777777777',
             '88888888888', '99999999999') THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate first verification digit
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(cpf, i, 1)::INTEGER * (11 - i));
  END LOOP;
  
  digit1 := 11 - (sum1 % 11);
  IF digit1 >= 10 THEN
    digit1 := 0;
  END IF;
  
  -- Calculate second verification digit
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(cpf, i, 1)::INTEGER * (12 - i));
  END LOOP;
  
  digit2 := 11 - (sum2 % 11);
  IF digit2 >= 10 THEN
    digit2 := 0;
  END IF;
  
  -- Verify digits
  RETURN (substring(cpf, 10, 1)::INTEGER = digit1) AND 
         (substring(cpf, 11, 1)::INTEGER = digit2);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE public.linked_users IS 'Usuários vinculados por CPF que podem visualizar processos';
COMMENT ON TABLE public.process_access IS 'Controle de acesso de usuários vinculados aos processos';
COMMENT ON FUNCTION public.get_processes_by_cpf(TEXT) IS 'Retorna processos acessíveis por um CPF específico';
COMMENT ON FUNCTION public.validate_cpf(TEXT) IS 'Valida formato e dígitos verificadores do CPF';

-- =====================================================
-- 10. SAMPLE DATA (OPTIONAL - FOR DEVELOPMENT)
-- =====================================================

-- Uncomment the following lines for development/testing
/*
-- Sample linked users (replace UUIDs with real ones from your auth.users)
INSERT INTO public.linked_users (owner_user_id, linked_user_cpf, linked_user_name, linked_user_email, permissions)
VALUES 
  ('11111111-1111-1111-1111-111111111111', '12345678901', 'João da Silva', 'joao@email.com', '{"view_processes": true, "view_documents": true, "view_reports": false}'),
  ('11111111-1111-1111-1111-111111111111', '98765432100', 'Maria Santos', 'maria@email.com', '{"view_processes": true, "view_documents": false, "view_reports": false}');
*/
