
create table if not exists public.app_version (
  id int primary key default 1,
  major int not null default 1,
  minor int not null default 1,
  updated_at timestamptz not null default now(),
  constraint app_version_singleton check (id = 1)
);

insert into public.app_version (id, major, minor)
values (1, 1, 1)
on conflict (id) do nothing;

grant select on public.app_version to anon, authenticated;
grant all on public.app_version to service_role;

alter table public.app_version enable row level security;

drop policy if exists "read app version" on public.app_version;
create policy "read app version"
  on public.app_version
  for select
  using (true);

create or replace function public.bump_app_version()
returns table(major int, minor int)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_major int;
  cur_minor int;
  next_major int;
  next_minor int;
begin
  select av.major, av.minor into cur_major, cur_minor
  from public.app_version av where av.id = 1 for update;

  if cur_minor + 1 >= 5 then
    next_major := cur_major + 1;
    next_minor := 0;
  else
    next_major := cur_major;
    next_minor := cur_minor + 1;
  end if;

  update public.app_version
    set major = next_major,
        minor = next_minor,
        updated_at = now()
   where id = 1;

  return query select next_major, next_minor;
end;
$$;

grant execute on function public.bump_app_version() to anon, authenticated, service_role;
