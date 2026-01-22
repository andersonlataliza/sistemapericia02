insert into public.process_access (process_id, linked_user_id, granted_by)
select
  p.id,
  lu.id,
  lu.owner_user_id
from public.linked_users lu
join public.processes p
  on p.user_id = lu.owner_user_id
where lu.status = 'active'
  and lu.auth_user_id is not null
on conflict (process_id, linked_user_id) do nothing;
