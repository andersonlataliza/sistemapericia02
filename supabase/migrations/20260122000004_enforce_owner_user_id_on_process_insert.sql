CREATE OR REPLACE FUNCTION public.enforce_owner_user_id_on_process_insert()
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

DROP TRIGGER IF EXISTS trg_enforce_owner_user_id_on_process_insert ON public.processes;
CREATE TRIGGER trg_enforce_owner_user_id_on_process_insert
BEFORE INSERT ON public.processes
FOR EACH ROW
EXECUTE FUNCTION public.enforce_owner_user_id_on_process_insert();
