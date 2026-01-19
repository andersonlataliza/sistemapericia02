ALTER TABLE public.manufacturer_technical_bulletins
  ADD COLUMN IF NOT EXISTS estimated_lifetime TEXT;
