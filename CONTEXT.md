# CONTEXT.md — Hackathon Evaluator

> Full project context for developers and AI agents. Read this before touching any code.

---

## What is this?

A real-time web app for live hackathon events. ~36 people in one room. 12 teams pitch one by one. Everyone rates every team except their own. An admin controls the entire flow. Results are revealed at the end.

---

## Roles

| Role | Description |
|------|-------------|
| `participant` | Team member. Votes on all teams except their own. |
| `observer` | Organiser / mentor. Votes on all teams. Selects "Not a participant" on join. |
| `admin` | Controls the session. Accesses admin panel via hardcoded password. |

---

## How participants join

1. Admin creates a session → a 6-char join code is generated (e.g. `HACK24`)
2. Admin activates the session and displays the code to the room
3. Participants open the app URL → enter code → enter name → select team → joined
4. Admin sees participants appear in real time on the lobby screen

> QR code on the admin lobby screen is a planned nice-to-have (comment exists in code).

---

## Data model (Supabase / Postgres)

### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `join_code` | text unique | 6-char uppercase, auto-generated |
| `criteria_labels` | text[] nullable | Admin-defined criteria labels (min 2) |
| `status` | text | `setup` → `active` → `voting_closed` → `results_revealed` |
| `current_pitch_index` | integer | -1 = not started |
| `timer_default_seconds` | integer | Default timer length for each new pitch (60) |
| `timer_duration_seconds` | integer | Current pitch timer length (can be extended) |
| `timer_paused_remaining_seconds` | integer nullable | Remaining seconds when timer is paused |
| `timer_started_at` | timestamptz | Set when admin triggers timer |
| `results_revealed_categories` | text[] | Category keys that have been revealed |
| `category_winners` | jsonb | Map of category key → team UUID, e.g. `{"overall":"uuid","criterion-0":"uuid"}` |
| `created_at` | timestamptz | |

### `teams`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `name` | text | |
| `pitch_order` | integer | 0-based |

### `participants`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `name` | text | |
| `team_id` | uuid FK nullable | Null if observer |
| `is_observer` | boolean | |
| `is_excluded` | boolean | Admin-toggled; excluded voter's scores omitted from all team averages |
| `joined_at` | timestamptz | |

### `votes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `participant_id` | uuid FK | |
| `team_id` | uuid FK | Team being evaluated |
| `criteria_scores` | integer[] | Scores aligned to `sessions.criteria_labels`, each 1–5 |
| `total_score` | integer | Computed sum of `criteria_scores` |
| `submitted_at` | timestamptz | |

> Unique constraint on `(participant_id, team_id)` — one vote per participant per team.

---

## Session state machine

```
setup → (admin activates) → active → (admin closes voting) → voting_closed → (admin reveals) → results_revealed
```

All state changes update the `sessions` row. Supabase Realtime broadcasts to all clients. Clients derive their screen from `session.status` + `session.current_pitch_index`.

---

## Realtime (Supabase)

| Subscription | Table | Event | Used for |
|---|---|---|---|
| All clients | `sessions` | UPDATE | Push screen transitions to participants |
| Admin | `participants` | INSERT | Show new joiners in real time (✅ live) |
| Admin | `votes` | INSERT | Voter tracking during pitch (Phase 2) |

---

## Screen map

### Participant
| Screen | When shown |
|--------|-----------|
| Join code entry | On app open |
| Name + team selection | After valid code entered |
| Lobby | After joining, waiting for session |
| Voting form | During a pitch (Phase 2) |
| Own team screen | When participant's own team is pitching |
| Results | After admin reveals results |

### Admin
| Screen | Purpose | Status |
|--------|---------|--------|
| Password gate | `/admin` | ✅ Done |
| Sessions list | View / manage all sessions | ✅ Done |
| New session | Create session, get join code | ✅ Done |
| Session setup | Add teams, activate session | ✅ Done |
| Session lobby | See who joined in real time | ✅ Done |
| Pitch control | Manage live pitches, timer, voter tracking | 🟡 Static UI done, needs wiring |
| Results panel | View scores, reveal to everyone | ⬜ Phase 3 |

---

## Score calculation

- Per criterion: average of the `criteria_scores[i]` values for a team
- Best Overall: sum of criterion averages
- Winners: **one winner per category** selected manually by the admin; admin clicks to crown one team per category
- Category labels come from `sessions.criteria_labels`

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Tailwind (Lovable) |
| Backend | Supabase (Postgres + Realtime) |
| Hosting | Lovable deploy |

---

## Environment variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ADMIN_PASSWORD=
```

---

## Key rules

1. Participant cannot vote for their own team
2. Observers can vote for all teams
3. Votes lock on submission (no editing in MVP)
4. Admin controls all transitions — nothing auto-advances
5. 1-min timer is guidance only — admin still manually advances
6. Results hidden until admin explicitly reveals them
7. No auth — admin password is a hardcoded env var
8. RLS disabled on all tables (internal tool)
9. Participant identity stored in localStorage as `hackathon_participant`
10. Admin auth stored in localStorage as `hackathon_admin_auth`
11. Session must have at least 2 admin-defined criteria before activation
12. Voter exclusion: admin can mark any participant (non-team-member) as excluded via the Pitch tab; excluded scores are omitted from ALL team averages (not just teams they didn't vote for); exclusion is togglable and persists in `participants.is_excluded`

---

## Future improvements

| # | Feature |
|---|---------|
| F1 | QR code on admin lobby screen |
| F2 | Configurable criterion weights per session |
| F3 | Custom criteria (not just the 4 hardcoded ones) |
| F4 | Participant can edit vote before timer ends |
| F5 | Optional text comment per team |
| F6 | Reconnection handling — restore screen on rejoin |
| F7 | Export results as CSV / PDF |
| F8 | Individual voter breakdown for admin |
| F9 | Admin can pause / extend timer |
| F10 | Multiple session history view |

---

## Repo files

| File | Purpose |
|------|---------|
| `CONTEXT.md` | This file — full spec for humans and AI agents |
| `STORIES.md` | User stories with completion status |
| `supabase/schema.sql` | Run this to initialise the DB |
