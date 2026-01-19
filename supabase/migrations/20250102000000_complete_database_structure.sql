-- =====================================================
-- MIGRATION: Complete Database Structure for Sistema de Perícia
-- Created: 2025-01-02
-- Description: Estrutura completa do banco de dados consolidada
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. PROFILES TABLE (User Management)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. PROCESSES TABLE (Main Entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Process Information
  process_number TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  defendant_name TEXT NOT NULL,
  court TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'archived')),
  
  -- Inspection Scheduling
  inspection_date TIMESTAMPTZ,
  inspection_address TEXT,
  inspection_time TEXT,
  inspection_notes TEXT,
  inspection_duration_minutes INTEGER DEFAULT 60,
  inspection_reminder_minutes INTEGER DEFAULT 30,
  inspection_status TEXT DEFAULT 'scheduled_pending' CHECK (inspection_status IN ('scheduled_pending', 'scheduled_confirmed', 'rescheduled', 'cancelled', 'completed')),
  
  -- Payment Information
  determined_value NUMERIC(12,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
  payment_amount NUMERIC(12,2) DEFAULT 0,
  payment_date DATE,
  payment_notes TEXT,
  payment_due_date DATE,
  expert_fee NUMERIC(10,2) DEFAULT 0,
  
  -- Laudo Structure - Cover and Identification
  cover_data JSONB DEFAULT '{}'::jsonb,
  identifications JSONB DEFAULT '{}'::jsonb,
  
  -- Parties Data
  claimant_data JSONB DEFAULT '{}'::jsonb,
  defendant_data JSONB DEFAULT '{}'::jsonb,
  
  -- Process Documentation
  objective TEXT,
  initial_data TEXT,
  defense_data TEXT,
  diligence_data JSONB DEFAULT '[]'::jsonb,
  methodology TEXT,
  documents_presented JSONB DEFAULT '[]'::jsonb,
  attendees JSONB DEFAULT '[]'::jsonb,
  
  -- Workplace and Activities
  workplace_characteristics JSONB DEFAULT '{}'::jsonb,
  activities_description TEXT,
  
  -- Safety Equipment
  epis JSONB DEFAULT '[]'::jsonb,
  epcs TEXT,
  collective_protection TEXT,
  
  -- Analysis and Results
  insalubrity_analysis TEXT,
  insalubrity_results TEXT,
  periculosity_analysis TEXT,
  periculosity_concept TEXT,
  periculosity_results TEXT,
  flammable_definition TEXT,
  
  -- Final Report
  conclusion TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. RISK_AGENTS TABLE (Risk Assessment)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.risk_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  
  -- Agent Information
  agent_type TEXT NOT NULL CHECK (agent_type IN ('physical', 'chemical', 'biological', 'ergonomic', 'accident')),
  agent_name TEXT NOT NULL,
  description TEXT,
  
  -- Assessment Data
  exposure_level TEXT,
  measurement_method TEXT,
  measurement_value NUMERIC,
  measurement_unit TEXT,
  tolerance_limit NUMERIC,
  tolerance_unit TEXT,
  
  -- Risk Classification
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  insalubrity_degree TEXT CHECK (insalubrity_degree IN ('minimum', 'medium', 'maximum')),
  periculosity_applicable BOOLEAN DEFAULT FALSE,
  
  -- Additional Data
  notes TEXT,
  evidence_photos JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. QUESTIONNAIRES TABLE (Questions and Answers)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  
  -- Question Information
  party TEXT NOT NULL CHECK (party IN ('claimant', 'defendant', 'judge')),
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  
  -- Additional Data
  notes TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 5. REPORTS TABLE (Generated Reports)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  
  -- Report Information
  report_type TEXT NOT NULL CHECK (report_type IN ('preliminary', 'final', 'supplementary', 'clarification')),
  title TEXT NOT NULL,
  content TEXT,
  
  -- Report Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'delivered')),
  version INTEGER DEFAULT 1,
  
  -- File Information
  file_path TEXT,
  file_size INTEGER,
  file_type TEXT,
  
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6. DOCUMENTS TABLE (File Management)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  
  -- Document Information
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  
  -- Document Classification
  category TEXT CHECK (category IN ('initial_petition', 'defense', 'evidence', 'photo', 'measurement', 'report', 'other')),
  is_confidential BOOLEAN DEFAULT FALSE,
  
  -- Upload Information
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Processes indexes
CREATE INDEX IF NOT EXISTS idx_processes_user_id ON public.processes(user_id);
CREATE INDEX IF NOT EXISTS idx_processes_process_number ON public.processes(process_number);
CREATE INDEX IF NOT EXISTS idx_processes_status ON public.processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_inspection_date ON public.processes(inspection_date);
CREATE INDEX IF NOT EXISTS idx_processes_payment_status ON public.processes(payment_status);
CREATE INDEX IF NOT EXISTS idx_processes_created_at ON public.processes(created_at);

-- Risk agents indexes
CREATE INDEX IF NOT EXISTS idx_risk_agents_process_id ON public.risk_agents(process_id);
CREATE INDEX IF NOT EXISTS idx_risk_agents_agent_type ON public.risk_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_risk_agents_risk_level ON public.risk_agents(risk_level);

-- Questionnaires indexes
CREATE INDEX IF NOT EXISTS idx_questionnaires_process_id ON public.questionnaires(process_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_party ON public.questionnaires(party);

-- Reports indexes
CREATE INDEX IF NOT EXISTS idx_reports_process_id ON public.reports(process_id);
CREATE INDEX IF NOT EXISTS idx_reports_report_type ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON public.documents(process_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_risk_agents_updated_at
  BEFORE UPDATE ON public.risk_agents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_questionnaires_updated_at
  BEFORE UPDATE ON public.questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- FUNCTION FOR NEW USER PROFILE CREATION
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Processes policies
CREATE POLICY "Users can view own processes" ON public.processes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processes" ON public.processes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processes" ON public.processes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own processes" ON public.processes
  FOR DELETE USING (auth.uid() = user_id);

-- Risk agents policies
CREATE POLICY "Users can view risk agents of own processes" ON public.risk_agents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = risk_agents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert risk agents for own processes" ON public.risk_agents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = risk_agents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update risk agents of own processes" ON public.risk_agents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = risk_agents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete risk agents of own processes" ON public.risk_agents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = risk_agents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- Questionnaires policies
CREATE POLICY "Users can view questionnaires of own processes" ON public.questionnaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = questionnaires.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questionnaires for own processes" ON public.questionnaires
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = questionnaires.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update questionnaires of own processes" ON public.questionnaires
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = questionnaires.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete questionnaires of own processes" ON public.questionnaires
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = questionnaires.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- Reports policies
CREATE POLICY "Users can view reports of own processes" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = reports.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reports for own processes" ON public.reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = reports.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reports of own processes" ON public.reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = reports.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reports of own processes" ON public.reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = reports.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- Documents policies
CREATE POLICY "Users can view documents of own processes" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = documents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents for own processes" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = documents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update documents of own processes" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = documents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents of own processes" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.processes 
      WHERE processes.id = documents.process_id 
      AND processes.user_id = auth.uid()
    )
  );

-- =====================================================
-- STORAGE BUCKET FOR DOCUMENTS
-- =====================================================

-- Create storage bucket for process documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('process-documents', 'process-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload documents for own processes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view documents of own processes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update documents of own processes" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete documents of own processes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

-- Table comments
COMMENT ON TABLE public.profiles IS 'User profiles and personal information';
COMMENT ON TABLE public.processes IS 'Main processes table containing all case information';
COMMENT ON TABLE public.risk_agents IS 'Risk agents identified and assessed in each process';
COMMENT ON TABLE public.questionnaires IS 'Questions and answers from different parties';
COMMENT ON TABLE public.reports IS 'Generated reports and documents';
COMMENT ON TABLE public.documents IS 'File attachments and evidence documents';

-- Key column comments for processes table
COMMENT ON COLUMN public.processes.cover_data IS 'Dados da capa do laudo (cidade, data, perito, etc.)';
COMMENT ON COLUMN public.processes.identifications IS 'Identificações do processo (número, partes, vara)';
COMMENT ON COLUMN public.processes.claimant_data IS 'Dados completos do reclamante (nome, cargos, períodos)';
COMMENT ON COLUMN public.processes.defendant_data IS 'Dados completos da reclamada';
COMMENT ON COLUMN public.processes.workplace_characteristics IS 'Características do local de trabalho (área, pé-direito, construção, etc.)';
COMMENT ON COLUMN public.processes.epis IS 'Equipamentos de proteção individual utilizados';
COMMENT ON COLUMN public.processes.diligence_data IS 'Dados das diligências realizadas';
COMMENT ON COLUMN public.processes.determined_value IS 'Valor determinado/acordado para o processo';
COMMENT ON COLUMN public.processes.payment_status IS 'Status do pagamento: pending, partial, paid, overdue';
COMMENT ON COLUMN public.processes.payment_amount IS 'Valor já pago';
COMMENT ON COLUMN public.processes.payment_date IS 'Data do último pagamento';
COMMENT ON COLUMN public.processes.payment_notes IS 'Observações sobre o pagamento';
COMMENT ON COLUMN public.processes.payment_due_date IS 'Data de vencimento do pagamento';

-- =====================================================
-- END OF MIGRATION
-- =====================================================