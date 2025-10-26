-- Adicionar campos do laudo completo na tabela processes
ALTER TABLE processes
ADD COLUMN IF NOT EXISTS objective TEXT,
ADD COLUMN IF NOT EXISTS methodology TEXT,
ADD COLUMN IF NOT EXISTS workplace_characteristics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS activities_description TEXT,
ADD COLUMN IF NOT EXISTS epis JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS epcs TEXT,
ADD COLUMN IF NOT EXISTS insalubrity_analysis TEXT,
ADD COLUMN IF NOT EXISTS periculosity_analysis TEXT,
ADD COLUMN IF NOT EXISTS conclusion TEXT,
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS documents_presented JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS expert_fee NUMERIC(10,2) DEFAULT 0;

-- Criar tabela para quesitos e respostas
CREATE TABLE IF NOT EXISTS questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  party TEXT NOT NULL, -- 'claimant', 'defendant', 'judge'
  question_number INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para otimizar buscas por processo
CREATE INDEX IF NOT EXISTS idx_questionnaires_process_id ON questionnaires(process_id);

-- RLS policies para questionnaires
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view questionnaires of their processes"
  ON questionnaires FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM processes 
    WHERE processes.id = questionnaires.process_id 
    AND processes.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage questionnaires of their processes"
  ON questionnaires FOR ALL
  USING (EXISTS (
    SELECT 1 FROM processes 
    WHERE processes.id = questionnaires.process_id 
    AND processes.user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_questionnaires_updated_at
  BEFORE UPDATE ON questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();