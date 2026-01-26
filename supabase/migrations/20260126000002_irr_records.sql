CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.irr_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  representative_controversy TEXT NOT NULL,
  theme_type TEXT NOT NULL CHECK (theme_type IN ('insalubridade', 'periculosidade')),
  legal_thesis TEXT NOT NULL,
  attachment_path TEXT NOT NULL,
  attachment_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.irr_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS irr_records_select_own ON public.irr_records;
CREATE POLICY irr_records_select_own
  ON public.irr_records
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS irr_records_insert_own ON public.irr_records;
CREATE POLICY irr_records_insert_own
  ON public.irr_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS irr_records_update_own ON public.irr_records;
CREATE POLICY irr_records_update_own
  ON public.irr_records
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS irr_records_delete_own ON public.irr_records;
CREATE POLICY irr_records_delete_own
  ON public.irr_records
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS irr_records_select_owner_for_linked_users ON public.irr_records;
CREATE POLICY irr_records_select_owner_for_linked_users
  ON public.irr_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id = irr_records.user_id
    )
  );

DROP TRIGGER IF EXISTS enforce_owner_user_id_on_irr_insert ON public.irr_records;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'enforce_owner_user_id_for_linked_account'
  ) THEN
    EXECUTE '
      CREATE TRIGGER enforce_owner_user_id_on_irr_insert
        BEFORE INSERT ON public.irr_records
        FOR EACH ROW
        EXECUTE FUNCTION public.enforce_owner_user_id_for_linked_account();
    ';
  END IF;
END $$;

DROP POLICY IF EXISTS "Linked users can view owner's materials" ON storage.objects;
CREATE POLICY "Linked users can view owner's materials" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'process-documents' AND
    (storage.foldername(name))[2] IN ('material-consulta', 'boletins-tecnicos', 'fispq', 'calibracao', 'irr') AND
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Linked users can upload owner's materials" ON storage.objects;
CREATE POLICY "Linked users can upload owner's materials" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'process-documents' AND
    (storage.foldername(name))[2] IN ('material-consulta', 'boletins-tecnicos', 'fispq', 'calibracao', 'irr') AND
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id::text = (storage.foldername(name))[1]
    )
  );
