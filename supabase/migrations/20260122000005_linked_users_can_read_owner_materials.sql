DROP POLICY IF EXISTS manufacturer_technical_bulletins_select_owner_for_linked_users ON public.manufacturer_technical_bulletins;
CREATE POLICY manufacturer_technical_bulletins_select_owner_for_linked_users
  ON public.manufacturer_technical_bulletins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id = manufacturer_technical_bulletins.user_id
    )
  );

DROP POLICY IF EXISTS fispq_records_select_owner_for_linked_users ON public.fispq_records;
CREATE POLICY fispq_records_select_owner_for_linked_users
  ON public.fispq_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
        AND lu.owner_user_id = fispq_records.user_id
    )
  );

DROP POLICY IF EXISTS "Linked users can view owner's materials" ON storage.objects;
CREATE POLICY "Linked users can view owner's materials" ON storage.objects
  FOR SELECT
  USING (
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
