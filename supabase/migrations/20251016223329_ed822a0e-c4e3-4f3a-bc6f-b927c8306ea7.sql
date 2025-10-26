-- Criar tabela de perfis de usuários (peritos)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  professional_title TEXT,
  registration_number TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Criar tabela de processos
CREATE TABLE public.processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL,
  defendant_name TEXT NOT NULL,
  court TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  inspection_date TIMESTAMPTZ,
  inspection_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

-- Políticas para processes
CREATE POLICY "Users can view their own processes"
  ON public.processes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own processes"
  ON public.processes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own processes"
  ON public.processes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processes"
  ON public.processes FOR DELETE
  USING (auth.uid() = user_id);

-- Criar tabela de documentos
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('initial_petition', 'defense', 'questionnaires', 'medical_records', 'ltcat', 'ppp', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_data JSONB
);

-- Habilitar RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Políticas para documents
CREATE POLICY "Users can view documents of their processes"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = documents.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create documents for their processes"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = documents.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents of their processes"
  ON public.documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = documents.process_id
      AND processes.user_id = auth.uid()
    )
  );

-- Criar tabela de agentes de risco identificados
CREATE TABLE public.risk_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  intensity_value NUMERIC,
  unit TEXT,
  frequency TEXT,
  exposure_hours_per_day NUMERIC,
  exposure_days_per_week NUMERIC,
  period_start DATE,
  period_end DATE,
  epi_type TEXT,
  epi_ca TEXT,
  epi_effective BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.risk_agents ENABLE ROW LEVEL SECURITY;

-- Políticas para risk_agents
CREATE POLICY "Users can view risk agents of their processes"
  ON public.risk_agents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = risk_agents.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage risk agents of their processes"
  ON public.risk_agents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = risk_agents.process_id
      AND processes.user_id = auth.uid()
    )
  );

-- Criar tabela de laudos gerados
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  report_content TEXT,
  report_docx_url TEXT,
  report_pdf_url TEXT,
  conclusion TEXT,
  insalubrity_grade TEXT,
  periculosity_identified BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Políticas para reports
CREATE POLICY "Users can view reports of their processes"
  ON public.reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = reports.process_id
      AND processes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create reports for their processes"
  ON public.reports FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.processes
      WHERE processes.id = reports.process_id
      AND processes.user_id = auth.uid()
    )
  );

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Função para criar profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar profile automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Criar bucket de storage para documentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'process-documents',
  'process-documents',
  false,
  52428800,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg']
);

-- Políticas de storage para documentos
CREATE POLICY "Users can view their own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'process-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );