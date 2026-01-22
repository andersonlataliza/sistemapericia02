create or replace function public.is_process_owner(_process_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.processes p
    where p.id = _process_id
      and p.user_id = auth.uid()
  );
$$;

drop policy if exists "Users can manage access to their own processes" on public.process_access;
create policy "Users can manage access to their own processes" on public.process_access
  for all
  using (public.is_process_owner(process_id))
  with check (public.is_process_owner(process_id));
