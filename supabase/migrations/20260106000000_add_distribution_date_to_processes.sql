-- Adiciona campo de data de distribuição do processo
ALTER TABLE IF EXISTS public.processes
  ADD COLUMN IF NOT EXISTS distribution_date DATE;

