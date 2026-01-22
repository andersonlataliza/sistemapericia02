CREATE OR REPLACE FUNCTION public.enforce_owner_user_id_for_linked_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT lu.owner_user_id
  INTO v_owner_id
  FROM public.linked_users lu
  WHERE lu.auth_user_id = auth.uid()
    AND lu.status = 'active'
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    NEW.user_id := v_owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_owner_user_id_on_bulletins_insert ON public.manufacturer_technical_bulletins;
CREATE TRIGGER enforce_owner_user_id_on_bulletins_insert
  BEFORE INSERT ON public.manufacturer_technical_bulletins
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_user_id_for_linked_account();

DROP TRIGGER IF EXISTS enforce_owner_user_id_on_fispq_insert ON public.fispq_records;
CREATE TRIGGER enforce_owner_user_id_on_fispq_insert
  BEFORE INSERT ON public.fispq_records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_owner_user_id_for_linked_account();

DROP POLICY IF EXISTS "Linked users can upload owner's materials" ON storage.objects;
CREATE POLICY "Linked users can upload owner's materials" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'process-documents' AND
    (storage.foldername(name))[2] IN ('material-consulta', 'boletins-tecnicos', 'fispq') AND
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id::text = (storage.foldername(name))[1]
    )
  );
