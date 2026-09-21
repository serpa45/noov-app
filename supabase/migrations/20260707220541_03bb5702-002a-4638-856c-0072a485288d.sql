
create or replace function public.bump_app_version()
returns table(major int, minor int)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_minor int;
begin
  update public.app_version
     set minor = minor + 1,
         updated_at = now()
   where id = 1
  returning app_version.minor into next_minor;

  return query select 0 as major, next_minor;
end;
$$;
