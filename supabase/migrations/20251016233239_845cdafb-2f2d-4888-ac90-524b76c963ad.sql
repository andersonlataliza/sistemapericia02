-- Add new fields to processes table for complete laudo structure
ALTER TABLE public.processes
ADD COLUMN IF NOT EXISTS cover_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS identifications jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS claimant_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS defendant_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS initial_data text,
ADD COLUMN IF NOT EXISTS defense_data text,
ADD COLUMN IF NOT EXISTS diligence_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS collective_protection text,
ADD COLUMN IF NOT EXISTS insalubrity_results text,
ADD COLUMN IF NOT EXISTS periculosity_concept text,
ADD COLUMN IF NOT EXISTS flammable_definition text,
ADD COLUMN IF NOT EXISTS periculosity_results text;

COMMENT ON COLUMN public.processes.cover_data IS 'Dados da capa do laudo';
COMMENT ON COLUMN public.processes.identifications IS 'Identificações do processo';
COMMENT ON COLUMN public.processes.claimant_data IS 'Dados completos do reclamante';
COMMENT ON COLUMN public.processes.defendant_data IS 'Dados completos da reclamada';
COMMENT ON COLUMN public.processes.initial_data IS 'Dados da inicial';
COMMENT ON COLUMN public.processes.defense_data IS 'Dados da contestação';
COMMENT ON COLUMN public.processes.diligence_data IS 'Dados da diligência (local, data, comprovante)';
COMMENT ON COLUMN public.processes.collective_protection IS 'Equipamentos de proteção coletiva';
COMMENT ON COLUMN public.processes.insalubrity_results IS 'Resultados das avaliações de insalubridade';
COMMENT ON COLUMN public.processes.periculosity_concept IS 'Conceito de periculosidade';
COMMENT ON COLUMN public.processes.flammable_definition IS 'Definição de materiais inflamáveis';
COMMENT ON COLUMN public.processes.periculosity_results IS 'Resultados das avaliações de periculosidade';