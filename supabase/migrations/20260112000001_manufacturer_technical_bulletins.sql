CREATE TABLE IF NOT EXISTS public.manufacturer_technical_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  epi TEXT NOT NULL,
  ca TEXT NOT NULL,
  protection_type TEXT NOT NULL,
  attachment_path TEXT NOT NULL,
  attachment_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.manufacturer_technical_bulletins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manufacturer_technical_bulletins_select_own ON public.manufacturer_technical_bulletins;
CREATE POLICY manufacturer_technical_bulletins_select_own
  ON public.manufacturer_technical_bulletins
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS manufacturer_technical_bulletins_insert_own ON public.manufacturer_technical_bulletins;
CREATE POLICY manufacturer_technical_bulletins_insert_own
  ON public.manufacturer_technical_bulletins
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS manufacturer_technical_bulletins_update_own ON public.manufacturer_technical_bulletins;
CREATE POLICY manufacturer_technical_bulletins_update_own
  ON public.manufacturer_technical_bulletins
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS manufacturer_technical_bulletins_delete_own ON public.manufacturer_technical_bulletins;
CREATE POLICY manufacturer_technical_bulletins_delete_own
  ON public.manufacturer_technical_bulletins
  FOR DELETE
  USING (auth.uid() = user_id);
