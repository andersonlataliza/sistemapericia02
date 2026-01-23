-- Adiciona campo de data máxima de entrega do laudo
ALTER TABLE IF EXISTS public.processes
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

