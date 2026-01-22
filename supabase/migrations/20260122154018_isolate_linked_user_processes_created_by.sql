ALTER TABLE public.processes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.processes
SET created_by = user_id
WHERE created_by IS NULL;

CREATE OR REPLACE FUNCTION public.enforce_created_by_on_process_upsert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      NEW.created_by := OLD.created_by;
    END IF;
    IF NEW.created_by IS NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_created_by_on_process_upsert ON public.processes;
CREATE TRIGGER trg_enforce_created_by_on_process_upsert
BEFORE INSERT OR UPDATE ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_created_by_on_process_upsert();

CREATE OR REPLACE FUNCTION public.grant_linked_users_access_on_process_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.process_access (process_id, linked_user_id, granted_by)
  SELECT
    NEW.id,
    lu.id,
    auth.uid()
  FROM public.linked_users lu
  WHERE lu.owner_user_id = NEW.user_id
    AND lu.status = 'active'
    AND lu.auth_user_id = auth.uid()
  ON CONFLICT (process_id, linked_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_linked_users_access_on_process_insert ON public.processes;
CREATE TRIGGER trg_grant_linked_users_access_on_process_insert
AFTER INSERT ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.grant_linked_users_access_on_process_insert();

DROP POLICY IF EXISTS "Linked users can view accessible processes" ON public.processes;
DROP POLICY IF EXISTS "Linked users can view own created processes" ON public.processes;
CREATE POLICY "Linked users can view own created processes" ON public.processes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.owner_user_id = processes.user_id
        AND lu.status = 'active'
    )
    AND processes.created_by = auth.uid()
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
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = process_access.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can update own created processes" ON public.processes;
CREATE POLICY "Linked users can update own created processes" ON public.processes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.owner_user_id = processes.user_id
        AND lu.status = 'active'
    )
    AND processes.created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.owner_user_id = processes.user_id
        AND lu.status = 'active'
    )
    AND processes.created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Linked users can delete own created processes" ON public.processes;
CREATE POLICY "Linked users can delete own created processes" ON public.processes
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.owner_user_id = processes.user_id
        AND lu.status = 'active'
    )
    AND processes.created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Linked users can view risk agents of own created processes" ON public.risk_agents;
CREATE POLICY "Linked users can view risk agents of own created processes" ON public.risk_agents
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = risk_agents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can insert risk agents for own created processes" ON public.risk_agents;
CREATE POLICY "Linked users can insert risk agents for own created processes" ON public.risk_agents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = risk_agents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can update risk agents of own created processes" ON public.risk_agents;
CREATE POLICY "Linked users can update risk agents of own created processes" ON public.risk_agents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = risk_agents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can delete risk agents of own created processes" ON public.risk_agents;
CREATE POLICY "Linked users can delete risk agents of own created processes" ON public.risk_agents
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = risk_agents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can view questionnaires of own created processes" ON public.questionnaires;
CREATE POLICY "Linked users can view questionnaires of own created processes" ON public.questionnaires
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = questionnaires.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can insert questionnaires for own created processes" ON public.questionnaires;
CREATE POLICY "Linked users can insert questionnaires for own created processes" ON public.questionnaires
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = questionnaires.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can update questionnaires of own created processes" ON public.questionnaires;
CREATE POLICY "Linked users can update questionnaires of own created processes" ON public.questionnaires
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = questionnaires.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can delete questionnaires of own created processes" ON public.questionnaires;
CREATE POLICY "Linked users can delete questionnaires of own created processes" ON public.questionnaires
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = questionnaires.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can view reports of own created processes" ON public.reports;
CREATE POLICY "Linked users can view reports of own created processes" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = reports.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can insert reports for own created processes" ON public.reports;
CREATE POLICY "Linked users can insert reports for own created processes" ON public.reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = reports.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can update reports of own created processes" ON public.reports;
CREATE POLICY "Linked users can update reports of own created processes" ON public.reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = reports.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can delete reports of own created processes" ON public.reports;
CREATE POLICY "Linked users can delete reports of own created processes" ON public.reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = reports.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can view documents of own created processes" ON public.documents;
CREATE POLICY "Linked users can view documents of own created processes" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = documents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can insert documents for own created processes" ON public.documents;
CREATE POLICY "Linked users can insert documents for own created processes" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = documents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can update documents of own created processes" ON public.documents;
CREATE POLICY "Linked users can update documents of own created processes" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = documents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can delete documents of own created processes" ON public.documents;
CREATE POLICY "Linked users can delete documents of own created processes" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id = documents.process_id
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can upload documents for own created processes" ON storage.objects;
CREATE POLICY "Linked users can upload documents for own created processes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'process-documents'
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.user_id::text = (storage.foldername(name))[1]
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can view documents of own created processes" ON storage.objects;
CREATE POLICY "Linked users can view documents of own created processes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'process-documents'
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.user_id::text = (storage.foldername(name))[1]
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can update documents of own created processes" ON storage.objects;
CREATE POLICY "Linked users can update documents of own created processes" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'process-documents'
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.user_id::text = (storage.foldername(name))[1]
        AND p.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Linked users can delete documents of own created processes" ON storage.objects;
CREATE POLICY "Linked users can delete documents of own created processes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'process-documents'
    AND EXISTS (
      SELECT 1
      FROM public.processes p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.user_id::text = (storage.foldername(name))[1]
        AND p.created_by = auth.uid()
    )
  );
