DROP POLICY IF EXISTS "Users can view own linked users" ON public.linked_users;
CREATE POLICY "Users can view own linked users" ON public.linked_users
  FOR SELECT USING (
    owner_user_id = auth.uid() OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can insert own linked users" ON public.linked_users;
CREATE POLICY "Users can insert own linked users" ON public.linked_users
  FOR INSERT WITH CHECK (
    owner_user_id = auth.uid() AND
    COALESCE(NULLIF(auth.jwt() -> 'user_metadata' ->> 'is_linked', '')::boolean, false) = false
  );

DROP POLICY IF EXISTS "Users can update own linked users" ON public.linked_users;
CREATE POLICY "Users can update own linked users" ON public.linked_users
  FOR UPDATE USING (
    owner_user_id = auth.uid() AND
    COALESCE(NULLIF(auth.jwt() -> 'user_metadata' ->> 'is_linked', '')::boolean, false) = false
  )
  WITH CHECK (
    owner_user_id = auth.uid() AND
    COALESCE(NULLIF(auth.jwt() -> 'user_metadata' ->> 'is_linked', '')::boolean, false) = false
  );

DROP POLICY IF EXISTS "Users can delete own linked users" ON public.linked_users;
CREATE POLICY "Users can delete own linked users" ON public.linked_users
  FOR DELETE USING (
    owner_user_id = auth.uid() AND
    COALESCE(NULLIF(auth.jwt() -> 'user_metadata' ->> 'is_linked', '')::boolean, false) = false
  );

DROP POLICY IF EXISTS "Linked users can view their process access" ON public.process_access;
CREATE POLICY "Linked users can view their process access" ON public.process_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.id = process_access.linked_user_id
        AND lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Linked users can view accessible processes" ON public.processes;
CREATE POLICY "Linked users can view accessible processes" ON public.processes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.process_access pa
      INNER JOIN public.linked_users lu ON lu.id = pa.linked_user_id
      WHERE pa.process_id = processes.id
        AND lu.auth_user_id = auth.uid()
        AND lu.status = 'active'
    )
  );
