create or replace function public.sum_int_array(arr integer[])
returns integer
language sql
immutable
as $$
  select coalesce(sum(v), 0)::integer from unnest(arr) as v;
$$;

alter table public.votes
drop column if exists total_score;

alter table public.votes
drop column if exists pitch_index;

alter table public.votes
drop column if exists score_technicality;

alter table public.votes
drop column if exists score_pitch;

alter table public.votes
drop column if exists score_functionality;

alter table public.votes
drop column if exists score_innovation;

alter table public.votes
add column total_score integer generated always as (
  public.sum_int_array(criteria_scores)
) stored;

