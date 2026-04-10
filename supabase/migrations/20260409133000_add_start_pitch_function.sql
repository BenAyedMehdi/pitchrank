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
  -- Lock the session row to avoid conflicting pitch starts.
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
    status = case when v_current_status = 'setup' then 'active' else v_current_status end
  where id = p_session_id;
end;
$$;
