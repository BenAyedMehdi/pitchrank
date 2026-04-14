alter table public.sessions
add column if not exists timer_default_seconds integer;

update public.sessions
set timer_default_seconds = 60
where timer_default_seconds is null;

alter table public.sessions
alter column timer_default_seconds set default 60;

alter table public.sessions
alter column timer_default_seconds set not null;

alter table public.sessions
add column if not exists timer_duration_seconds integer;

update public.sessions
set timer_duration_seconds = coalesce(timer_duration_seconds, timer_default_seconds, 60);

alter table public.sessions
alter column timer_duration_seconds set default 60;

alter table public.sessions
alter column timer_duration_seconds set not null;

alter table public.sessions
add column if not exists timer_paused_remaining_seconds integer;

alter table public.sessions
drop constraint if exists sessions_timer_default_seconds_positive_check;

alter table public.sessions
add constraint sessions_timer_default_seconds_positive_check
check (timer_default_seconds > 0);

alter table public.sessions
drop constraint if exists sessions_timer_duration_seconds_positive_check;

alter table public.sessions
add constraint sessions_timer_duration_seconds_positive_check
check (timer_duration_seconds > 0);

alter table public.sessions
drop constraint if exists sessions_timer_paused_remaining_seconds_check;

alter table public.sessions
add constraint sessions_timer_paused_remaining_seconds_check
check (
  timer_paused_remaining_seconds is null
  or (
    timer_paused_remaining_seconds >= 0
    and timer_paused_remaining_seconds <= timer_duration_seconds
  )
);

create or replace function public.start_pitch(
  p_session_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_pitch_order integer;
  v_current_status text;
begin
  select status
  into v_current_status
  from public.sessions
  where id = p_session_id
  for update;

  if v_current_status is null then
    raise exception 'Session with ID % not found.', p_session_id;
  elsif v_current_status not in ('setup', 'active') then
    raise exception 'Cannot start a pitch for session % in status "%". Session must be in "setup" or "active" state.', p_session_id, v_current_status;
  end if;

  select pitch_order
  into v_pitch_order
  from public.teams
  where id = p_team_id
    and session_id = p_session_id;

  if v_pitch_order is null then
    raise exception 'Team with ID % not found for session %.', p_team_id, p_session_id;
  end if;

  update public.sessions
  set
    current_pitch_index = v_pitch_order,
    status = case when v_current_status = 'setup' then 'active' else v_current_status end,
    timer_duration_seconds = timer_default_seconds,
    timer_started_at = null,
    timer_paused_remaining_seconds = null
  where id = p_session_id;
end;
$$;
