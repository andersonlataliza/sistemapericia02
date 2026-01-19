CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.fispq_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_identification TEXT,
  hazard_identification TEXT,
  composition TEXT,
  nr15_annex TEXT,
  tolerance_limit TEXT,
  skin_absorption_risk TEXT,
  flash_point TEXT,
  attachment_path TEXT NOT NULL,
  attachment_name TEXT NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fispq_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fispq_records_select_own ON public.fispq_records;
CREATE POLICY fispq_records_select_own
  ON public.fispq_records
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS fispq_records_insert_own ON public.fispq_records;
CREATE POLICY fispq_records_insert_own
  ON public.fispq_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fispq_records_update_own ON public.fispq_records;
CREATE POLICY fispq_records_update_own
  ON public.fispq_records
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fispq_records_delete_own ON public.fispq_records;
CREATE POLICY fispq_records_delete_own
  ON public.fispq_records
  FOR DELETE
  USING (auth.uid() = user_id);
