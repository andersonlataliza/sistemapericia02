CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sumula_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sumula_number TEXT NOT NULL,
  legal_issue TEXT NOT NULL,
  attachment_path TEXT NOT NULL,
  attachment_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sumula_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sumula_records_select_own ON public.sumula_records;
CREATE POLICY sumula_records_select_own
  ON public.sumula_records
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sumula_records_insert_own ON public.sumula_records;
CREATE POLICY sumula_records_insert_own
  ON public.sumula_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sumula_records_update_own ON public.sumula_records;
CREATE POLICY sumula_records_update_own
  ON public.sumula_records
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS sumula_records_delete_own ON public.sumula_records;
CREATE POLICY sumula_records_delete_own
  ON public.sumula_records
  FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS sumula_records_select_owner_for_linked_users ON public.sumula_records;
CREATE POLICY sumula_records_select_owner_for_linked_users
  ON public.sumula_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id = sumula_records.user_id
    )
  );

DROP TRIGGER IF EXISTS enforce_owner_user_id_on_sumula_insert ON public.sumula_records;
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
      CREATE TRIGGER enforce_owner_user_id_on_sumula_insert
        BEFORE INSERT ON public.sumula_records
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
    (storage.foldername(name))[2] IN ('material-consulta', 'boletins-tecnicos', 'fispq', 'calibracao', 'irr', 'nota-tecnica', 'sumula') AND
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
    (storage.foldername(name))[2] IN ('material-consulta', 'boletins-tecnicos', 'fispq', 'calibracao', 'irr', 'nota-tecnica', 'sumula') AND
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id::text = (storage.foldername(name))[1]
    )
  );
