# PitchRank - Supabase setup

This project already contains Supabase migrations and frontend integration.
The steps below move you from Lovable Cloud to your own `supabase.com` project.

## 1) Create your Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **New project**.
3. Choose org, project name, region, and database password.
4. Wait until the project is fully provisioned.

## 2) Get project credentials

From Supabase dashboard:

- `Project Settings -> API -> Project URL` -> use as `VITE_SUPABASE_URL`
- `Project Settings -> API -> anon public` -> use as `VITE_SUPABASE_PUBLISHABLE_KEY`
- `Project Settings -> General -> Reference ID` -> your `project_id` (project ref)

## 3) Configure frontend env

1. Copy `.env.example` to `.env`
2. Fill values:

```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_SUPABASE_ANON_KEY"
```

> `VITE_SUPABASE_PROJECT_ID` is not required by app code.

## 4) Link Supabase CLI to your project

Install CLI if needed:

```bash
brew install supabase/tap/supabase
```

Then from project root:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

This updates the local Supabase linkage and should align `supabase/config.toml`.

## 5) Run database migrations on your project

Apply all SQL in `supabase/migrations`:

```bash
supabase db push
```

Migrations included:

- `20260409011242_3652038a-051d-4216-a303-ecf308b04799.sql`
  - Creates tables: `sessions`, `teams`, `participants`, `votes`
  - Adds constraints/FKs/checks and generated `total_score`
  - Enables RLS and adds permissive policies for anon/authenticated users
  - Adds realtime publication for `sessions` and `participants`
- `20260409011253_ddf2ff0e-4bf8-4461-9b76-cc9a36c630ca.sql`
  - Re-defines `generate_join_code()` with explicit `search_path`

## 6) Manual Supabase dashboard checks

After migration, verify:

1. **Table Editor** has all 4 tables in `public`.
2. **Database -> Functions** includes `generate_join_code`.
3. **Authentication -> Providers**
   - Not required for current flow (app uses anonymous DB access + localStorage identity).
4. **Database -> Replication**
   - `public.sessions` and `public.participants` should be part of realtime publication.
5. **API -> RLS**
   - Policies named `Allow all on ...` exist on each table.

## 7) Run app locally

```bash
npm install
npm run dev
```

## 8) Optional hardening before production

Current migration allows full anon access. For production, replace permissive RLS with stricter policies (for example by join code/session-scoped access or authenticated roles).
