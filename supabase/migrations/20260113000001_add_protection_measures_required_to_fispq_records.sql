ALTER TABLE IF EXISTS public.fispq_records
  ADD COLUMN IF NOT EXISTS protection_measures_required TEXT;
