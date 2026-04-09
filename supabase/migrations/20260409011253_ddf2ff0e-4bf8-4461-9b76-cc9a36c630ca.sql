
create or replace function public.generate_join_code()
returns text as $$
  select upper(substring(md5(random()::text) from 1 for 6));
$$ language sql
set search_path = public;
