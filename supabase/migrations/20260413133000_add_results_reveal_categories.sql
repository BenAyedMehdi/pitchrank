alter table public.sessions
add column if not exists results_revealed_categories text[] not null default '{}';
