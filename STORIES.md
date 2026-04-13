# STORIES.md — Hackathon Evaluator

> User stories and feature tracker.
> `[x]` done · `[~]` in progress · `[ ]` not started
> 🔴 Must have · 🟡 Nice to have

---

## Phase 1 — Foundation & join flow ✅ Complete

| ID | Story | Priority | Done |
|----|-------|----------|------|
| A1 | Admin accesses panel via hardcoded password | 🔴 | [x] |
| A2 | Admin creates a session with a name | 🔴 | [x] |
| A3 | Session gets an auto-generated 6-char join code | 🔴 | [x] |
| A4 | Admin can regenerate the join code before activating | 🔴 | [x] |
| A5 | Admin adds teams one by one (min 2 to activate) | 🔴 | [x] |
| A6 | Admin edits or deletes teams before activation | 🔴 | [x] |
| A7 | Admin activates session — team list locks | 🔴 | [x] |
| A8 | Admin sees all sessions in a list with status | 🔴 | [x] |
| A9 | Admin sees real-time list of participants who joined | 🔴 | [x] |
| D1 | Participant enters join code to find the session | 🔴 | [x] |
| D2 | Participant enters name + selects team (or "Not a participant") | 🔴 | [x] |
| D3 | Participant lands on lobby/waiting screen after joining | 🔴 | [x] |

---

## Phase 2 — Pitch control & voting 🟡 In progress

### Admin — pitch control (Supabase-backed, partial flow live)

| ID | Story | Priority | Done |
|----|-------|----------|------|
| B1 | Admin selects a team and marks their pitch as started | 🔴 | [x] |
| B2 | Starting a pitch opens the voting form on all participant screens | 🔴 | [x] |
| B3 | Admin triggers 1-min timer — countdown appears on all screens simultaneously | 🔴 | [x] |
| B4 | Admin sees in real time who has voted and who hasn't for current pitch | 🔴 | [x] |
| B5 | Admin sees vote count, percentage, and pending voter list | 🔴 | [x] |
| B6 | Admin closes voting for current team | 🔴 | [X] |
| B7 | Admin advances to next team | 🔴 | [ ] |
| B8 | Admin can pause or extend the timer | 🟡 | [X] |

### Participant — voting

| ID | Story | Priority | Done |
|----|-------|----------|------|
| E1 | Participant sees current team name + "Pitch X of Y" when pitch starts | 🔴 | [X] |
| E2 | Participant rates team on 4 criteria (Technicality, Pitch, Functionality, Innovation) — each 1 to 5 | 🔴 | [X] |
| E3 | Participant's own team pitch shows a passive "sit back and enjoy" screen instead of the form | 🔴 | [X] |
| E4 | 1-min countdown appears on participant screen when admin triggers it | 🔴 | [X] |
| E5 | Vote locks after submission — no double voting | 🔴 | [X] |
| E6 | Participant sees a between-pitches waiting screen after voting | 🔴 | [X] |
| E7 | Participant can add optional short comment per team | 🟡 | [ ] |
| E8 | Participant can edit vote before timer ends or admin advances | 🟡 | [X] |
| D4 | Participant can rejoin and be restored to correct screen if tab is closed | 🟡 | [ ] |

---

## Phase 3 — Results

| ID | Story | Priority | Done |
|----|-------|----------|------|
| C1 | Admin sees full results table: avg scores per team per criterion | 🔴 | [X] |
| C2 | Admin sees top 3 winners per category (Overall, Technical, Pitch, Functionality, Innovation) | 🔴 | [X] |
| C3 | Admin reveals results to all participants with one button | 🔴 | [X] |
| F1 | All participant screens update simultaneously to show results | 🔴 | [X] |
| F2 | Participant can view their own submitted ratings | 🔴 | [ ] |
| C4 | Admin can export results as CSV or PDF | 🟡 | [ ] |
| C5 | Admin sees individual voter breakdown (who gave what to whom) | 🟡 | [ ] |
| F3 | Results page is shareable via link | 🟡 | [ ] |

---

## Nice-to-haves (no phase assigned)

| ID | Story | Priority |
|----|-------|----------|
| N1 | QR code shown on admin lobby screen for easy mobile join | 🟡 |
| N2 | Admin configures criterion weights per session | 🟡 |
| N3 | Admin defines custom criteria | 🟡 |
| N4 | Multiple session history view | 🟡 |

---

## Realtime subscriptions status

| Subscription | Status |
|---|---|
| Admin ← new participants joining | ✅ Live |
| All clients ← session state changes | ✅ Wired, awaiting phase 2 transitions |
| Admin ← new votes during pitch | ✅ Live on admin pitch screen |

---

## Feature branch updates (latest)

- Connected project to real Supabase (env-based client + migrations pushed)
- Added DB function `start_pitch(session_id, team_id)` and wired admin "Start Pitch" action via RPC
- Replaced `AdminPitchScreen` mock data with live Supabase data (`sessions`, `teams`, `participants`, `votes`)
- Added realtime refresh on admin pitch screen for session updates, new participants, and new votes
- Improved desktop UX for `AdminPitchScreen` and `AdminLobbyScreen` with responsive wide layouts and multi-column cards
