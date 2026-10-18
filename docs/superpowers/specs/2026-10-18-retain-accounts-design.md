# Retain accounts: HR and employee logins, quarterly check-ins

Date: 2026-10-18. Status: draft for owner approval.
Builds on: `2026-10-18-retain-design.md` (Phase A model, Phase B public web app, both shipped).

## Why

Retain is the owner's portfolio product. Today it is a public, no-login demo that only says who might
leave. The owner wants something they can walk a potential client through as a real product:

- an **HR login** that shows HR what to do about attrition, not just who is at risk;
- an **employee login** where people answer a short quarterly check-in, so the data stays fresh;
- the loop closing: employees answer → HR sees risk change → HR acts → next quarter shows whether it
  worked → employees see what changed.

Success: in one sitting the owner signs in as HR, then as an employee, and a client sees every step of
that loop on believable data, on a phone or a laptop, for free.

## Goals

1. One login page. The role on the account decides where you land (HR → HR dashboard, employee →
   their check-in). No role picker.
2. HR area, three pages and no more:
   - **Dashboard** (`/hr`): headcount, people at high risk, **cost at stake** (expected replacement
     cost of the at-risk group), change in average risk since last quarter, **Sharp drops since last
     check-in** (early warning), the at-risk people list with search and department filter, where risk
     concentrates (department × role heatmap), **What would keep people here** (expectation themes by
     department), and a compact "Can you trust these scores?" section (held-out accuracy, fairness
     summary, link-free).
   - **Person page** (`/hr/people/[id]`): name, role, department, risk score and band, the factors
     driving it with their actual values, a risk-over-quarters line, every check-in answer by quarter,
     what would keep them here, the what-if simulator, and **action plans** (create, see estimated
     effect, mark done, see next quarter's actual change).
   - **Check-ins** (`/hr/check-ins`): this quarter's response rate overall and by department, who has
     not responded, and **You said, we did** updates HR posts to a department.
3. Employee area, one page plus the form:
   - **Home** (`/me`): this quarter's check-in status (open / done), **What would keep you here**,
     **You said, we did** for their department, and their own past answers. Never a risk score.
   - **Check-in** (`/me/check-in`): the quarterly questions, one short screen at a time.
4. The landing page stays (beautiful, with motion) but its calls to action go to sign-in. The public
   Explore, Workforce, Honesty and shared-scenario pages are removed; their useful parts move into the
   HR area.
5. Deploys stop burning free build minutes: images are built locally and Render only pulls them.

## Non-goals

- Real email (invites, password reset, notifications). No email provider; it would cost money.
- Self-service sign-up, SSO, multi-tenant organisations, manager role.
- Per-visitor data sandboxes.
- Model improvements. The owner asked for these; they are a separate follow-on piece of work, judged
  on the same held-out set, after this ships.

## Anti-goals (would make this a failure even if it works)

- The word **"Try"** anywhere in the UI.
- Pages that exist for their own sake. Every page above has a job; nothing else is added.
- An employee able to see any risk score: theirs or anyone's, in the UI **or the API**.
- A privacy promise on the form that the product then breaks.
- Anything that needs a paid tier, or keep-awake pinging that burns free hours.
- Protected attributes (Gender, Age, MaritalStatus) appearing as risk factors or what-if levers. They
  stay out of the model; they appear only in the fairness summary.

## Decisions (owner's)

- Two roles, one login, auto-routing by role. No "Try" wording.
- HR: dashboard, person page with risk factors and their numbers, who has responded this quarter.
- All four extras: action plans, early warning, you said / we did, cost at stake.
- Employee: quarterly check-in on the factors that drive leaving, plus an expectations section.
- No redundant pages; landing page stays beautiful.
- Build images locally and push them; don't build on Render.

## Decisions (made via /llm-council, owner may overrule)

**Auth: built in, not a hosted provider.**
- `users` (id, email unique, password hash, role `hr|employee`, employee_id nullable FK, display name).
- Password hashing with argon2id (`argon2-cffi`), parameters sized for a 512 MB instance
  (time_cost=2, memory_cost=19 MiB, parallelism=1).
- `sessions` table stores the SHA-256 of a random token (`secrets.token_urlsafe(32)`), user id,
  created, expires (12 h). The raw token lives only in the cookie. New session on every login; logout
  deletes the row; expired rows are ignored and pruned.
- Cookie `retain_session`: HttpOnly, Secure in production, SameSite=Lax, Path=/.
- Every state-changing request must carry an `Origin` header matching the site origin (CSRF).
- API dependencies `current_user`, `require_hr`, `require_employee`. Employee endpoints use response
  schemas that have no risk fields and only ever return the signed-in person's own data.
- Login is rate-limited per client IP and per email (10 attempts / 15 min), with the same generic
  error for wrong email and wrong password.

**One origin: the website proxies the API.**
- The browser talks only to the web origin. A Next.js route handler at `/api/[...path]` forwards
  requests to the API (method, body, query, cookies), returns status, body and `Set-Cookie` unchanged.
- It adds the real client IP and a shared secret header (`PROXY_SECRET`, env on both services). The
  API trusts the forwarded client IP only when the secret matches; otherwise it falls back to the
  current `client_ip` logic. This keeps per-IP rate limits meaningful behind the proxy.
- `NEXT_PUBLIC_API_URL` goes away; the web server needs `API_ORIGIN` (server-side) instead. CORS on the
  API can then be narrowed to nothing (browser never calls it directly).
- Route protection: Next 16 `proxy.ts` redirects signed-out visitors away from `/hr` and `/me` (cookie
  presence check only). The API is the real gate. `/login` redirects signed-in users to their home.

**Demo access.**
- Accounts exist only for 1 HR persona and 4 employee personas. The other 1,466 people are records
  without logins.
- Login page shows the email + password form and, under it, five named sign-in buttons, e.g.
  "Sign in as Priya Shah · HR manager", "Sign in as Daniel Ortiz · Sales". A button fills the form and
  submits it (real auth path). Demo passwords are public by design; the page says the data is
  fictional.
- Personas are picked from the dataset to tell a story:
  - HR: Priya Shah.
  - an employee at high risk whose latest check-in dropped sharply (shows early warning);
  - a stable, low-risk employee (shows the calm case);
  - an employee who has not answered this quarter (shows the open check-in flow);
  - an employee with an action plan that worked (risk fell after a pay review).
- **Daily reset:** rows created by visitors are flagged `seeded=false`. When the API starts, and on
  each login, if the last reset is more than 24 h old, visitor-created check-ins, action plans,
  updates and sessions are deleted, persona state is restored, and affected scores recomputed. (No
  scheduled job: the GitHub token lacks workflow scope and Render cron is not free.)

**Privacy: HR sees named answers, and the form says so.**
- Notice at the top of the check-in, word for word:
  "Your HR team sees your answers, with your name, so they can act on them. Your manager does not.
  You will never be shown a score."
- HR sees individual answers and expectations on the person page. Department-level expectation
  summaries hide any department with fewer than 5 responses this quarter.

**Scoring from check-ins: never overwrite the source data.**
- The IBM record stays as the baseline. Each check-in is a dated row. A person's current model input
  is the IBM record with the mapped fields replaced by their latest check-in answers.
- The check-in score is computed by the person's out-of-fold model (as today) at submit time and
  stored on the check-in row; `employees.risk_score` and drivers reflect the latest.
- Person page explains change in one sentence from the biggest driver delta, e.g. "Risk rose 18 pts
  since Q3, mostly because work-life balance dropped from 3 to 1."
- Early warning fires when any 1–4 answer drops by 2 or more, or risk rises 10 pts or more, versus the
  person's previous check-in. Small moves are not flagged.
- What-if results are labelled as the model's estimate, not a promise.

## Action plans (builder's call, recorded)

An action plan is a typed action, not free text (an optional note can be added). Each type maps to a
model lever, so its effect can be estimated and, once done, actually changes the person's inputs:

| Action | Change applied when marked done |
|---|---|
| Pay review | MonthlyIncome +10% |
| Promotion conversation | JobLevel +1 (max 5), YearsSinceLastPromotion = 0 |
| Reduce overtime | OverTime = No |
| Stock grant | StockOptionLevel +1 (max 3) |
| Training plan | TrainingTimesLastYear +2 (max 6) |
| Reduce travel | BusinessTravel one step lower |
| Stay interview | no lever (recorded, no score change) |

- Creating a plan stores the score at creation and the simulator's estimated score after the change.
- Marking it done writes the change into an **HR record overlay** for that person.
- Scoring order is: IBM baseline → HR record overlay (done plans, in order) → the latest check-in's
  mapped fields.
- A plan's **actual change** is the person's first check-in score after the plan was done, minus the
  score at creation. Until that check-in exists, the plan shows "waiting for next check-in".

## Who counts as staff (builder's call, recorded)

The 237 people with Attrition = Yes are former employees. They are not part of the live product: not
in headcount, not in the at-risk list, no check-ins, no accounts. Live headcount is 1,233. The model's
held-out results (which include them) appear only in "Can you trust these scores?". Cost at stake uses
the high-risk band and a 50% of annual salary replacement cost, adjustable on the dashboard.

## Quarters never go stale (builder's call, recorded)

Quarters are stored as real labels (e.g. `2026-Q4`), but seeded history is always generated relative
to the current quarter: three closed quarters plus the current open one. The daily reset checks the
quarter; if it has changed since the last seed, it regenerates seeded history so every persona's story
still holds. The reset also restores seeded rows that visitors edited (e.g. a seeded plan marked done),
not just deletes visitor-created rows.

## Landing hero visual (owner's choice)

Replace the empty drawn oval with **drifting people**: the hero's particle field becomes a loose crowd
of small person dots (one per current employee, thinned on small screens). Every few seconds a few
dots turn coral and drift away from the crowd, then ease back in, telling the product story in one
loop. The cursor gently parts the crowd. Canvas, no new dependency, paused off-screen, static under
reduced motion.

## The check-in

Questions map to model inputs so answers actually move the score. 1–4 scales use the dataset's own
anchors (1 Low, 2 Medium, 3 High, 4 Very high; work-life balance 1 Bad, 2 Good, 3 Better, 4 Best).

| Question (plain words) | Model input |
|---|---|
| How satisfied are you with your work environment? | EnvironmentSatisfaction |
| How satisfied are you with your job itself? | JobSatisfaction |
| How good are your working relationships? | RelationshipSatisfaction |
| How is your work-life balance? | WorkLifeBalance |
| How involved do you feel in your work? | JobInvolvement |
| Did you regularly work overtime this quarter? | OverTime |
| How often did you travel for work? | BusinessTravel |
| How many training sessions did you attend in the last 12 months? | TrainingTimesLastYear |

**What would keep you here** (same form, last step): pick up to 3 from Pay, Growth and promotion,
Flexible hours or remote work, Recognition, A better manager relationship, Less overtime, Learning and
training, Less travel, Job security; plus an optional comment (max 500 characters). Stored per
check-in. One check-in per person per quarter; resubmitting in the same quarter replaces it.

## Data the seed must create

The IBM data is one snapshot, so the seed builds believable history:

- Names for all 1,470 people (only the 1,233 current staff get check-ins) from fixed first/last-name lists with a fixed random seed (fictional,
  deterministic, no new dependency).
- Three closed quarters and the current open one, relative to today (see "Quarters never go stale").
- The last closed quarter equals the IBM values exactly (today's scores are preserved). The two earlier quarters drift
  from it by small random steps. The open quarter is answered by about 65% of people, drifting from the last closed quarter, with about
  4% showing sharp drops.
- Expectations for each answered check-in, weighted by that person's weak spots (low work-life balance
  → flexible hours, overtime → less overtime, low income for level → pay).
- About 40 seeded action plans created last quarter, with this quarter's outcomes where the person has answered.
- A few "You said, we did" updates per department across quarters.
- Seeding all of this stays a single bulk insert per table and finishes in well under a minute on
  Neon.

## Free-tier and deploy

- Images built locally with Docker (linux/amd64, so the Linux-trained model loads) and pushed to the
  GitHub Container Registry as public packages; Render services deploy from those images with
  auto-deploy off. Render build minutes go to roughly zero; the model trains once on the owner's
  machine.
- Moving the existing Render services from "build from repo" to "deploy image" may need recreating
  them. Anything that changes the owner's Render account or GitHub token scopes is done by the owner
  (or with their explicit go-ahead), with exact commands provided.
- No keep-awake pings. README tells the owner to open the site a minute before a demo.
- Neon: queries only on real requests; the reset runs at most once a day.

## Security requirements

- No risk fields in any employee-role response; tests prove it for every employee endpoint, including
  the what-if (employees have no what-if).
- HR-only endpoints return 401 signed out and 403 for employees.
- Free-text fields length-capped server-side; rendered as text only.
- Writes rate-limited per user (check-ins, action plans, updates).
- Session cookie never readable by scripts; tokens stored hashed.

## Left to the builder

Exact visual design of each page (must match the existing editorial style, motion and tokens),
component breakdown, API route names, migration layout, how the proxy route handler streams bodies,
copy beyond the strings fixed above, test layout, and the precise persona employee IDs.
