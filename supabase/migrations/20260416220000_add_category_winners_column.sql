alter table public.sessions
add column if not exists category_winners jsonb not null default '{}';
