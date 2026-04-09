
-- Helper function to generate a short uppercase join code
create or replace function public.generate_join_code()
returns text as $$
  select upper(substring(md5(random()::text) from 1 for 6));
$$ language sql;

-- Sessions table
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default public.generate_join_code(),
  status text not null default 'setup' check (status in ('setup', 'active', 'voting_closed', 'results_revealed')),
  current_pitch_index integer not null default -1,
  timer_started_at timestamptz,
  created_at timestamptz not null default now()
);

-- Teams table
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  pitch_order integer not null default 0
);

-- Participants table
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null,
  team_id uuid references public.teams(id) on delete set null,
  is_observer boolean not null default false,
  joined_at timestamptz not null default now()
);

-- Votes table
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  pitch_index integer not null,
  score_technicality integer not null check (score_technicality between 1 and 5),
  score_pitch integer not null check (score_pitch between 1 and 5),
  score_functionality integer not null check (score_functionality between 1 and 5),
  score_innovation integer not null check (score_innovation between 1 and 5),
  total_score integer generated always as (score_technicality + score_pitch + score_functionality + score_innovation) stored,
  submitted_at timestamptz not null default now(),
  unique (participant_id, team_id)
);

-- Disable RLS on all tables (no auth in this app)
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.participants enable row level security;
alter table public.votes enable row level security;

-- Allow all operations for anon and authenticated (no auth app)
create policy "Allow all on sessions" on public.sessions for all using (true) with check (true);
create policy "Allow all on teams" on public.teams for all using (true) with check (true);
create policy "Allow all on participants" on public.participants for all using (true) with check (true);
create policy "Allow all on votes" on public.votes for all using (true) with check (true);

-- Enable realtime on sessions and participants
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.participants;
