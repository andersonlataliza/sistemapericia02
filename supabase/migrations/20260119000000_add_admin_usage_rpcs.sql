CREATE OR REPLACE FUNCTION public.admin_database_usage()
RETURNS TABLE (
  db_size_bytes bigint,
  processes_table_bytes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pg_database_size(current_database())::bigint,
    pg_total_relation_size('public.processes')::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_database_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_database_usage() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_users_usage()
RETURNS TABLE (
  user_id uuid,
  processes_count bigint,
  processes_bytes bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    COUNT(*)::bigint,
    COALESCE(SUM(pg_column_size(p))::bigint, 0::bigint)
  FROM public.processes p
  GROUP BY p.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_users_usage() TO authenticated;
