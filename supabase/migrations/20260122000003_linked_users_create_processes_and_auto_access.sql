-- Allow linked accounts to create processes under their owner account
DROP POLICY IF EXISTS "Linked users can create processes for owner" ON public.processes;
CREATE POLICY "Linked users can create processes for owner" ON public.processes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.linked_users lu
      WHERE lu.auth_user_id = auth.uid()
        AND lu.owner_user_id = processes.user_id
        AND lu.status = 'active'
    )
  );

-- Auto-grant access to all active linked users when a new process is created
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
    NEW.user_id
  FROM public.linked_users lu
  WHERE lu.owner_user_id = NEW.user_id
    AND lu.status = 'active'
    AND lu.auth_user_id IS NOT NULL
  ON CONFLICT (process_id, linked_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_linked_users_access_on_process_insert ON public.processes;
CREATE TRIGGER trg_grant_linked_users_access_on_process_insert
AFTER INSERT ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.grant_linked_users_access_on_process_insert();

-- Backfill: if a linked user created a process under their own auth user_id,
-- move ownership to the owner account so the owner sees all related data.
UPDATE public.processes p
SET user_id = lu.owner_user_id
FROM public.linked_users lu
WHERE lu.auth_user_id IS NOT NULL
  AND lu.status = 'active'
  AND p.user_id = lu.auth_user_id
  AND p.user_id <> lu.owner_user_id;

-- Ensure process_access exists for all owner processes (including backfilled ones)
INSERT INTO public.process_access (process_id, linked_user_id, granted_by)
SELECT
  p.id,
  lu.id,
  lu.owner_user_id
FROM public.linked_users lu
JOIN public.processes p
  ON p.user_id = lu.owner_user_id
WHERE lu.status = 'active'
  AND lu.auth_user_id IS NOT NULL
ON CONFLICT (process_id, linked_user_id) DO NOTHING;
