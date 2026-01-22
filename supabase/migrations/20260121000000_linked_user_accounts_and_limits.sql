ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS max_linked_users INTEGER;

ALTER TABLE public.linked_users
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.enforce_linked_users_limit()
RETURNS TRIGGER AS $$
DECLARE
  limit_value INTEGER;
  current_count INTEGER;
BEGIN
  SELECT max_linked_users INTO limit_value
  FROM public.profiles
  WHERE id = NEW.owner_user_id;

  IF limit_value IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.linked_users
  WHERE owner_user_id = NEW.owner_user_id;

  IF current_count >= limit_value THEN
    RAISE EXCEPTION 'limite_de_usuarios_vinculados_excedido';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_linked_users_limit ON public.linked_users;

CREATE TRIGGER trg_enforce_linked_users_limit
BEFORE INSERT ON public.linked_users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_linked_users_limit();
