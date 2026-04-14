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

## Phase 2 — Pitch control & voting ✅ Complete

### Admin — pitch control (Supabase-backed, partial flow live)

| ID | Story | Priority | Done |
|----|-------|----------|------|
| B1 | Admin selects a team and marks their pitch as started | 🔴 | [x] |
| B2 | Starting a pitch opens the voting form on all participant screens | 🔴 | [x] |
| B3 | Admin triggers 1-min timer — countdown appears on all screens simultaneously | 🔴 | [x] |
| B4 | Admin sees in real time who has voted and who hasn't for current pitch | 🔴 | [x] |
| B5 | Admin sees vote count, percentage, and pending voter list | 🔴 | [x] |
| B6 | Admin closes voting for current team | 🔴 | [X] |
| B7 | Admin advances to next team | 🔴 | [X] |
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

## Phase 3 — Results ✅ Complete

| ID | Story | Priority | Done |
|----|-------|----------|------|
| C1 | Admin sees full results table: avg scores per team per criterion | 🔴 | [X] |
| C2 | Admin sees top 3 winners per category (Overall, Technical, Pitch, Functionality, Innovation) | 🔴 | [X] |
| C3 | Admin reveals results to all participants with one button | 🔴 | [X] |
| F1 | All participant screens update simultaneously to show results | 🔴 | [X] |
| F2 | Participant can view their own submitted ratings | 🔴 | [X] |
| C4 | Admin can export results as CSV or PDF | 🟡 | [X] |
| C5 | Admin sees individual voter breakdown (who gave what to whom) | 🟡 | [X] |
| F3 | Results page is shareable via link | 🟡 | [X] |

---

## Phase 4 — UX Improvements & Polish

### Admin — Sessions page

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G1 | Admin sessions list has an improved responsive layout for both desktop and mobile (better spacing, card or table layout that adapts to screen size) | 🔴 | [ ] |
| G2 | Admin can delete a session from the sessions list (with a confirmation dialog to prevent accidental deletion) | 🔴 | [ ] |

### Admin — Create / Edit Session page

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G3 | Create session page is fully responsive and fills the entire screen width on desktop, consistent with the layout of other admin tabs | 🔴 | [ ] |
| G4 | Creating criteria and teams is more user-friendly: inline editing, clearer labels, better spacing, and intuitive add/remove controls | 🔴 | [ ] |
| G5 | Admin can reorder teams via drag-and-drop (or up/down arrow buttons) in the create/edit session page | 🔴 | [ ] |

### Admin — Pitch tab

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G6 | When a pitch starts the countdown timer does **not** start automatically — it only starts when the admin explicitly triggers it (after the team has finished pitching), giving voters 1 minute to finalise their scores | 🔴 | [ ] |
| G7 | The status indicator next to a team name in the pitch tab shows a **yellow "in-progress" icon** while at least one voter has not yet submitted a vote, and switches to a **green tick** only once **all** voters have submitted their vote | 🔴 | [ ] |
| G8 | Each team is assigned a distinct random colour from a predefined palette of clear, readable colours; these colours are consistently used in the pitch tab and the results page to visually differentiate teams | 🟡 | [ ] |

### Voter — Join screen

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G9 | When a voter tries to join with a name that already exists in the session, they are shown an error message and asked to enter a different name before proceeding | 🔴 | [ ] |

### Voter — Voting view

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G10 | After submitting a vote, a voter can edit their scores for that pitch as long as the admin has not yet closed voting for that team (i.e. the voting session for that pitch is still open) | 🔴 | [ ] |

### Admin — Results page

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G11 | All scores displayed are **averages** (0–5 scale, e.g. 4.32) so that differences in voter turnout do not unfairly influence rankings | 🔴 | [ ] |
| G12 | Results page shows the **top 5 teams** for each category, ranked by their average score | 🔴 | [ ] |
| G13 | Admin can **manually select a winner** for each category from the ranked list (to handle the rule that a team cannot win more than one category); the UI clearly shows which teams are already assigned a win in another category | 🔴 | [ ] |
| G14 | The option to reveal individual category results separately is **removed**; instead, once the admin has selected winners for all categories, a single "Reveal All Results" button broadcasts the complete results to all participants simultaneously | 🔴 | [ ] |
| G15 | The admin results page has an improved layout optimised for laptop use: clear hierarchy, readable tables, winner cards, and good use of horizontal space | 🟡 | [ ] |
| G16 | Team colours (defined in G8) are used consistently on the results page to visually link scores and winner cards back to the correct team | 🟡 | [ ] |

### CSV Export

| ID | Story | Priority | Done |
|----|-------|----------|------|
| G17 | CSV export is restructured so that columns are grouped by team then by category, rows are individual voters, and the last row contains the per-column average. Format example:<br><br>`(blank),(blank),Team 1,,,,Team 2,,,`<br>`(blank),Cat1,Cat2,Cat3,Overall,Cat1,Cat2,Cat3,Overall`<br>`Voter1,x,x,x,x,x,x,x,x`<br>`Voter2,x,x,x,x,x,x,x,x`<br>`Avg,AvgT1C1,AvgT1C2,AvgT1C3,AvgT1,AvgT2C1,AvgT2C2,AvgT2C3,AvgT2` | 🟡 | [ ] |

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
