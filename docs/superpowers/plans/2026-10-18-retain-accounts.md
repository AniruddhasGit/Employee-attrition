# Retain Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Retain from a public demo into a two-role product: HR and employee logins, quarterly check-ins that re-score people, action plans, early warnings, "you said, we did", and a drifting-people hero, deployed from locally built images.

**Architecture:**
- The FastAPI app gains:
  - cookie sessions;
  - role-gated `/api/hr/*` and `/api/me/*` routers;
  - a check-in and action-plan scoring layer over the untouched IBM baseline;
  - a seed that generates three closed quarters plus the open one, with a daily demo reset.
- Next.js proxies `/api/*` to the API through a route handler, so the browser sees one origin.
  - The HR area is `/hr`, `/hr/people/[id]` and `/hr/check-ins`.
  - The employee area is `/me` and `/me/check-in`.
- Public explore, workforce, honesty and share pages are removed.

**Tech Stack:**
- Python 3.12: FastAPI 0.143, SQLAlchemy 2.1, Alembic 1.20, psycopg 3, argon2-cffi, XGBoost (CPU build), pytest.
- Next.js 16.4.2 (App Router, `proxy.ts`), React 19, Tailwind v4, motion 14, Phosphor icons, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-retain-accounts-design.md`

## Global Constraints

- **Copy:**
  - The word "Try" never appears in any UI string; an e2e test greps the rendered pages.
  - The check-in notice is, verbatim: "Your HR team sees your answers, with your name, so they can act on them. Your manager does not. You will never be shown a score."
  - HR labels are exactly "Sharp drops since last check-in" and "What would keep people here". The employee label is "What would keep you here".
- **Employees never see a risk score:** no `riskScore`, `riskBand`, `drivers`, `before`, `after`, `delta` or `score` key in any `/api/me/*` response, at any depth.
- **Protected attributes:** Gender, Age and MaritalStatus are never model inputs, levers, check-in fields or HR factors.
- **Former staff:** people with `attrition == 1` are excluded. Live headcount is 1,233. They get no check-ins and no accounts, and do not appear on the HR dashboard, people list or check-in status.
- **Quarter labels:** formatted `YYYY-Qn`. Seeded history is always the 3 closed quarters before the current one, plus the current one (open).
- **Auth:**
  - argon2id with `time_cost=2, memory_cost=19456, parallelism=1`.
  - Session token from `secrets.token_urlsafe(32)`; only its SHA-256 hex digest is stored. TTL is 12 h.
  - Cookie `retain_session`: HttpOnly, SameSite=Lax, Path=/, and Secure when `settings.cookie_secure`.
  - Login is limited to 10 attempts per 15 minutes per IP and per email. Wrong email and wrong password give the same response.
- **CSRF:** every POST, PATCH and DELETE needs an `Origin` header in `settings.site_origins`, or it gets 403.
- **Write limits:** check-in submits 10/hour per user; plan creates and updates 60/hour per user; team updates 20/hour per user.
- **Text caps:** check-in comment 500 characters; plan note 300; "you said" and "we did" 280 each. All are rendered as text, never as HTML.
- **Early warning** fires when any 1–4 answer drops by 2 or more, or risk rises by 0.10 or more, compared with the person's previous check-in.
- **Cost at stake** = sum of `monthly_income × 12 × replacement_pct/100` over current staff in the high band. The default `replacement_pct` is 50.
- **Demo password:** `settings.demo_password`, default `retain-demo`. There are exactly 5 accounts: 1 HR and 4 employees.
- **Free-tier rule:** no keep-awake pings and no scheduled jobs. The reset runs at most once per 24 h, on API startup or login.
- **Never push to `main` during this plan.** Only the final deploy task touches Render or GHCR, and only with the owner's go-ahead.
- **Next.js 16:** read `web/node_modules/next/dist/docs/` before writing Next code (per `web/AGENTS.md`). Middleware is `src/proxy.ts`.

## Review Focus

1. **A visitor submits a check-in twice in one quarter.** The second submit replaces the first: one row per person per quarter, and the score is recomputed. (Task 6 test `test_resubmit_same_quarter_replaces`.)
2. **The quarter rolls over while the API is running or asleep.** The next reset regenerates history so personas still tell their stories. (Task 5 test `test_reset_regenerates_on_new_quarter`.)
3. **An employee calls an HR endpoint directly, or an HR user calls `/api/me/*`.** HR endpoints return 403 to employees, and an HR user calling `/api/me/*` gets 403 as well. (Task 7 test `test_role_gates`.)
4. **Requests arrive through the web proxy.** Rate limits key on the real client IP only when the proxy secret matches. A forged `x-retain-client-ip` without the secret is ignored. (Task 4 test `test_forwarded_ip_requires_secret`.)
5. **The demo is used and left overnight.** Visitor-created rows disappear and edited seeded rows are restored. (Task 5 test `test_reset_removes_visitor_rows_and_restores_seeded`.)

---

### Task 1: Settings, dependencies, schema and migration

**Files:**
- Modify: `requirements.in`, `requirements.txt` (add `argon2-cffi`; replace `xgboost` with `xgboost-cpu` of the same version, so the Linux image stops pulling the ~200 MB `nvidia-nccl` wheel).
- Modify: `api/settings.py`. Add:
  - `site_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]`, using the same splitter as `cors_origins`;
  - `proxy_secret: str = ""`;
  - `cookie_secure: bool = False`;
  - `session_ttl_hours: int = 12`;
  - `demo_password: str = "retain-demo"`.
- Modify: `api/models.py`. Add the columns and tables listed below.
- Create: `api/migrations/versions/0002_accounts.py`.
- Test: `tests/api/test_models_accounts.py`.

**Model changes in `api/models.py`:**
- `Employee` gains:
  - `name: str` (String 80);
  - `is_current: bool` (indexed; `attrition == 0`);
  - `record: dict` (Json, default `{}`; the HR record overlay).
- New table `User`: `users`, with:
  - `id`;
  - `email` (unique, String 254, stored lowercase);
  - `password_hash`;
  - `role` (`"hr" | "employee"`);
  - `employee_id` (FK, nullable);
  - `display_name`;
  - `created_at`.
- New table `Session`: `sessions`, with:
  - `id`;
  - `token_hash` (String 64, unique);
  - `user_id` (FK, cascade delete);
  - `created_at`;
  - `expires_at` (indexed).
- New table `CheckIn`: `check_ins`, with:
  - `id`;
  - `employee_id` (FK, indexed);
  - `quarter` (String 7);
  - `answers` (Json, keys are the 8 model column names);
  - `keep_me` (Json list of expectation keys);
  - `comment` (Text);
  - `risk_score`;
  - `drivers` (Json, nullable);
  - `submitted_at`;
  - `seeded` (bool).
  - Unique constraint on (`employee_id`, `quarter`).
- New table `ActionPlan`: `action_plans`, with:
  - `id`;
  - `employee_id` (FK, indexed);
  - `action` (String 32);
  - `note`;
  - `created_quarter`;
  - `created_by` (user FK, nullable);
  - `score_at_creation`;
  - `estimated_score`;
  - `status` (`"open" | "done"`);
  - `done_at` (nullable);
  - `seeded`;
  - `seed_snapshot` (Json, nullable; the original seeded state, used by the reset);
  - `created_at`.
- New table `TeamUpdate`: `team_updates`, with:
  - `id`;
  - `department`;
  - `quarter`;
  - `said`;
  - `did`;
  - `created_by` (nullable);
  - `seeded`;
  - `created_at`.
- New table `DemoState`: `demo_state`, with:
  - `key` (String 32, PK);
  - `value` (Json).
- Drop table `scenarios` and the `Scenario` model.

**Interfaces:**
- Produces: the ORM classes `User`, `Session as UserSession` (aliased on import to avoid clashing with `sqlalchemy.orm.Session`), `CheckIn`, `ActionPlan`, `TeamUpdate`, `DemoState`, and `Employee.name / is_current / record`; plus the settings fields above.

- [ ] **Step 1: Write the failing test.** `test_accounts_schema_roundtrip`:
  - Create an `Employee`, a `User` linked to it, and two `CheckIn` rows for different quarters, then commit.
  - Assert that a third `CheckIn` with the same `(employee_id, quarter)` raises `IntegrityError`.
  - Assert that `User.email` is unique.
  - Assert that `Employee.record == {}` by default.
  - Also add `test_settings_accounts_defaults`: `Settings().session_ttl_hours == 12`, and `Settings(site_origins="https://a.com/,https://b.com").site_origins == ["https://a.com","https://b.com"]`.
- [ ] **Step 2: Run it.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_models_accounts.py -q`
  - Expected: FAIL (ImportError on `CheckIn`).
- [ ] **Step 3: Implement the models, settings and migration.**
  - Write `0002_accounts.py` by hand to mirror the models.
  - Make it drop `scenarios`.
  - Backfill `employees.name` as `''`, `is_current` as `attrition = 0`, and `record` as `'{}'`. The seed sets the real names.
  - Also update the `client` fixture in `tests/api/conftest.py` to truncate `sessions, check_ins, action_plans, team_updates, contact_messages` (not `scenarios`). Delete `tests/api/test_scenarios.py`, `api/routes/scenarios.py` and their include in `api/main.py`.
- [ ] **Step 4: Run the tests and the migration.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_models_accounts.py -q`
  - Expected: PASS.
  - Run: `.venv/Scripts/python -m alembic -c api/alembic.ini upgrade head` against the local DB.
  - Expected: no error.
- [ ] **Step 5: Commit** with message `feat(api): accounts, check-in, action plan and update tables`.

### Task 2: Quarters, check-in mapping and action levers (pure logic)

**Files:**
- Create: `api/quarters.py`, `api/scoring.py`.
- Test: `tests/api/test_quarters.py`, `tests/api/test_scoring.py`.

**Interfaces:**
- Produces from `api/quarters.py`:
  - `quarter_of(d: date) -> str`;
  - `previous(q: str) -> str`;
  - `history(current: str, closed: int = 3) -> list[str]`: oldest first, ending with `current`.
- Produces from `api/scoring.py`:
  - `CHECKIN_FIELDS: dict[str, str]`: API camelCase key → model column, for these 8 fields: environmentSatisfaction, jobSatisfaction, relationshipSatisfaction, workLifeBalance, jobInvolvement, overTime, businessTravel, trainingTimesLastYear.
  - `SCALE_FIELDS`: the five 1–4 columns.
  - `KEEP_ME: dict[str, str]`: key → label, in this order:
    - `pay` "Pay"
    - `growth` "Growth and promotion"
    - `flexibility` "Flexible hours or remote work"
    - `recognition` "Recognition"
    - `manager` "A better manager relationship"
    - `less_overtime` "Less overtime"
    - `learning` "Learning and training"
    - `less_travel` "Less travel"
    - `security` "Job security"
  - `ACTIONS: dict[str, str]`: key → label, for `pay_review`, `promotion`, `reduce_overtime`, `stock_grant`, `training_plan`, `reduce_travel` and `stay_interview`.
  - `apply_action(features: dict, action: str) -> dict`: returns a new dict with the spec's lever change, using the spec's caps.
  - `effective_features(base: dict, record: dict, answers: dict | None) -> dict`: `base | record | answers`, with answers keyed by model column.
  - `sharp_drop(prev_answers: dict | None, answers: dict, prev_score: float | None, score: float) -> list[str]`: the model columns that dropped by 2 or more. It returns `["risk"]` if the score rose by 0.10 or more, and `[]` if there is no previous check-in.
  - `change_sentence(prev_answers: dict, answers: dict, prev_score: float, score: float, prev_quarter: str) -> str`.

- [ ] **Step 1: Write the failing tests.**
  - `quarter_of(date(2026,10,18)) == "2026-Q4"`
  - `previous("2026-Q1") == "2025-Q4"`
  - `history("2026-Q4") == ["2026-Q1","2026-Q2","2026-Q3","2026-Q4"]`
  - `apply_action({"MonthlyIncome": 5000, ...}, "pay_review")["MonthlyIncome"] == 5500`
  - `promotion` on JobLevel 5 stays 5 and sets YearsSinceLastPromotion to 0.
  - `reduce_travel`: Travel_Frequently becomes Travel_Rarely, Travel_Rarely becomes Non-Travel, and Non-Travel stays unchanged.
  - `stock_grant` caps at 3; `training_plan` caps at 6.
  - `stay_interview` returns an equal dict.
  - `apply_action` does not mutate its input.
  - `effective_features` gives answers precedence over the record, and the record precedence over the base.
  - `sharp_drop({"WorkLifeBalance": 3}, {"WorkLifeBalance": 1}, 0.2, 0.25) == ["WorkLifeBalance"]`
  - `sharp_drop(None, {...}, None, 0.9) == []`
  - A score rise from 0.20 to 0.31 returns `["risk"]`.
  - `change_sentence` for that work-life case gives exactly "Risk rose 18 pts since 2026-Q3, mostly because work-life balance dropped from 3 to 1." (prev_score 0.20, score 0.38).
  - When there is no change, it gives "Risk is steady since 2026-Q3."
- [ ] **Step 2: Run them.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_quarters.py tests/api/test_scoring.py -q`
  - Expected: FAIL (module missing).
- [ ] **Step 3: Implement both modules.**
  - `change_sentence` picks, among the fields that changed, the one with the largest absolute change in the direction that matches the score's direction. Use lower-case plain names: "work-life balance", "job satisfaction", "workplace satisfaction", "working relationships", "job involvement", "overtime", "travel", "training".
  - Say "rose" or "fell", with points rounded from the score delta × 100.
  - If the absolute delta is under 0.02, say "Risk is steady since {q}."
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(api): quarter, check-in and action-lever logic`.

### Task 3: Batch scoring in the model service

**Files:**
- Modify: `api/service.py`.
- Test: `tests/api/test_service_batch.py`.

**Interfaces:**
- Consumes: `ModelService.fold_model` and `ml.explain.top_drivers`.
- Produces:
  - `ModelService.score_frame(df: pd.DataFrame) -> np.ndarray`: `df` has the FEATURES columns plus `fold`. It groups by fold, runs one `predict_proba` per fold, and returns the scores in the original row order.
  - `ModelService.drivers_for(features: dict, fold: int) -> list[dict]`: the top 5 drivers.

- [ ] **Step 1: Write the failing test.**
  - `score_frame` on 50 seeded employees' baseline features equals each `score_row(...)[0]` to 1e-9.
  - `drivers_for` returns 5 drivers, each with `feature`, `text` and `impact`.
- [ ] **Step 2: Run it.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_service_batch.py -q`
  - Expected: FAIL (AttributeError).
- [ ] **Step 3: Implement both methods.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(api): batch scoring by fold`.

### Task 4: Auth core: hashing, sessions, roles, origin check, proxied client IP

**Files:**
- Create: `api/auth.py`, `api/routes/auth.py`.
- Modify: `api/routes/contact.py` (move `client_ip` to `api/net.py` and teach it the proxy headers), `api/main.py`.
  - Include the auth router.
  - Remove `CORSMiddleware`: the browser now only talks to the web origin.
  - Register an Origin-check dependency, `require_same_origin`, on every router that has write routes.
- Create: `api/net.py`.
- Test: `tests/api/test_auth.py`, `tests/api/test_net.py`.

**Interfaces:**
- Produces from `api/net.py`:
  - `client_ip(request) -> str`. It returns `x-retain-client-ip` when `x-retain-proxy-secret` is present, equals `settings.proxy_secret`, and that setting is non-empty. Otherwise it keeps today's behaviour: cf-connecting-ip, true-client-ip, the rightmost X-Forwarded-For hop, then `client.host`.
- Produces from `api/auth.py`:
  - `hash_password(p: str) -> str` and `verify_password(h: str, p: str) -> bool`;
  - `open_session(db, user) -> str` (returns the raw token) and `close_session(db, raw: str) -> None`;
  - `CurrentUser = Annotated[User, Depends(current_user)]`: 401 when there is no valid session; it prunes the expired row it hits;
  - `HrUser` and `EmployeeUser` (403 on the wrong role);
  - `require_same_origin` (a dependency raising 403 for a write request without an allowed Origin);
  - `COOKIE = "retain_session"`.
- Produces these routes:
  - `POST /api/auth/login` takes `{email, password}`. It returns `{role, displayName, home}`, where `home` is `/hr` or `/me`, and sets the cookie. It returns 401 `{"detail":"Email or password is wrong."}` on failure and 429 when rate-limited. It calls `demo.maybe_reset` from Task 5 before checking credentials; until Task 5 lands, guard the call with a no-op stub.
  - `POST /api/auth/logout` deletes the session, clears the cookie, and returns 204.
  - `GET /api/auth/me` returns `{role, displayName, home}` or 401.

- [ ] **Step 1: Write the failing tests.**
  - `test_login_sets_httponly_cookie_and_routes_by_role`: an HR user gets home `/hr`, an employee gets `/me`. The `set-cookie` header contains `HttpOnly`, `SameSite=lax` and `Path=/`.
  - `test_wrong_password_and_unknown_email_same_response`.
  - `test_session_stored_hashed`: the raw cookie value never appears in `sessions.token_hash`, but its SHA-256 does.
  - `test_expired_session_is_401`.
  - `test_logout_deletes_session`.
  - `test_login_rate_limit_per_email`: the 11th attempt within the window returns 429.
  - `test_write_without_origin_is_403`, plus a matching Origin returns 200.
  - `test_forwarded_ip_requires_secret`: with `proxy_secret="s"`, headers `x-retain-client-ip: 9.9.9.9` and `x-retain-proxy-secret: s` give `9.9.9.9`. A wrong or missing secret falls back. An empty setting never trusts the header.
  - Tests send `Origin: http://localhost:3000` on POSTs, through a `post()` helper in conftest.
- [ ] **Step 2: Run them.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_auth.py tests/api/test_net.py -q`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - Contact keeps its existing per-IP limit, now through `net.client_ip`.
  - Update `tests/api/test_contact.py` to send the Origin header.
- [ ] **Step 4: Run the suite.**
  - Run: `.venv/Scripts/python -m pytest tests/api -q`
  - Expected: PASS. The old tests for public employee and workforce routes still pass until Task 7 removes them.
- [ ] **Step 5: Commit** with message `feat(api): cookie sessions, roles, origin check, proxy-aware client IP`.

### Task 5: Seed v2 (names, history, personas, plans, updates) and the daily demo reset

**Files:**
- Create: `api/names.py` (about 60 first names and 60 last names, varied in origin; `name_for(employee_id: int) -> str`, deterministic and seeded by id).
- Create: `api/demo.py`.
- Modify: `api/seed.py`.
- Test: `tests/api/test_seed.py` (extend), `tests/api/test_demo.py`.

**Interfaces:**
- Consumes: Task 2 (`history`, `apply_action`, `effective_features`, `CHECKIN_FIELDS`, `KEEP_ME`), Task 3 (`score_frame`, `drivers_for`), and Task 4 (`hash_password`).
- Produces from `api/demo.py`:
  - `PERSONAS: list[dict]`: 5 entries with `email`, `display_name`, `role`, `employee_id` (None for HR) and `story`. The story is one of `hr`, `sharp_drop`, `stable`, `not_answered` or `plan_worked`.
  - Emails: `priya.shah@retain.demo` for HR; employees are `firstname.lastname@retain.demo`, matching the generated names.
  - `seed_history(db, today: date) -> None`.
  - `maybe_reset(db, now: datetime) -> bool`: returns True if a reset ran.
  - `reset(db, today: date) -> None`.
- Produces from `api/seed.py`: `run(session, models_dir, force=False)`, which still loads employees (now with `name`, `is_current` and `record={}`) and then calls `demo.seed_history`.

**Algorithm notes. These are not determined by the tests, so follow them.**
- Use `random.Random(20261018)` for every draw, so seeding is deterministic.
- **The last closed quarter's answers** are the IBM values exactly.
- **The two earlier quarters:** each 1–4 answer moves by −1, 0 or +1 with probabilities 0.15/0.7/0.15, clamped to 1–4. OverTime flips with probability 0.08. BusinessTravel is unchanged. TrainingTimesLastYear moves by ±1, clamped to 0–6.
- **The current quarter:** 65% of current staff answer, drifting from the last closed quarter in the same way. 4% of those responders get a sharp drop: one random 1–4 field falls by 2, floored at 1.
- **Personas:**
  - **Pick rules:**
    - `sharp_drop`: a high-band person whose current answer has a sharp drop. Force one if none exists.
    - `stable`: a low band, with every answer the same as last quarter.
    - `not_answered`: no current-quarter check-in.
    - `plan_worked`: a person with a seeded `pay_review` plan created last quarter, done, and whose current score is at least 0.05 below `score_at_creation`. Force the drift in their favour if needed.
  - **Ordering:** pick personas deterministically, as the lowest employee_id that satisfies each story, from among current staff.
  - **Shaping history:** apply their history shaping before scoring.
- **Keep-me picks:** 1–3 per answered check-in, sampled with weights.
  - Base weight 1 for each key.
  - +4 `flexibility` if WorkLifeBalance ≤ 2.
  - +4 `less_overtime` if OverTime is Yes.
  - +3 `pay` if MonthlyIncome is below the median for that JobLevel.
  - +3 `growth` if YearsSinceLastPromotion ≥ 3.
  - +3 `manager` if RelationshipSatisfaction ≤ 2.
  - +3 `less_travel` if travel is Frequently.
  - +2 `learning` if training ≤ 1.
  - Comments are taken from a pool of about 20 short sentences keyed to the top pick, for 30% of check-ins.
- **About 40 seeded plans:** created last quarter for high-band current staff, with actions chosen by their top driver.
  - About half are marked done, and their lever is applied into `Employee.record`.
  - Store the original fields in `seed_snapshot`.
- **Team updates:** 2 per department per closed quarter, from a pool of "said/did" pairs tied to keep-me keys.
- **Scoring:**
  - Score every check-in with `score_frame` over `effective_features(base, record_as_of_that_quarter, answers)`. For simplicity the record applies from the quarter after the plan's creation onwards.
  - `drivers` are computed only for each person's latest check-in.
  - `Employee.risk_score`, `risk_band` and `drivers` come from the latest check-in.
- **Speed:** bulk insert per table. Seeding must finish in under 60 s against local Postgres, measured and printed by `python -m api.seed`.
- **Reset:**
  - `demo_state["seeded_quarter"]` and `demo_state["last_reset"]` hold the state.
  - `maybe_reset` runs `reset` when `last_reset` is more than 24 h ago, or when `quarter_of(today)` differs from `seeded_quarter`.
  - `reset` deletes all non-seeded check-ins, plans, updates and every session.
  - It restores seeded plans from `seed_snapshot` and rebuilds `Employee.record` from the seeded done plans.
  - If the quarter changed, it deletes all seeded rows and calls `seed_history` again.
  - Finally it rescores affected people and stamps `last_reset`.
  - Call `maybe_reset` on app startup (FastAPI lifespan) and in login.

- [ ] **Step 1: Write the failing tests.**
  - `test_seed_history_shape`:
    - exactly 4 distinct quarters, equal to `history(quarter_of(today))`;
    - former staff have zero check-ins;
    - current staff have 3 closed check-ins each;
    - the open-quarter response rate is between 0.6 and 0.7;
    - the last closed quarter's answers equal the IBM values for 5 sampled people.
  - `test_personas_tell_their_story`:
    - there are 5 users;
    - the `sharp_drop` persona has `sharp_drop(...)` non-empty for their latest pair and is in the high band;
    - `not_answered` has no current-quarter row;
    - `plan_worked` has a done `pay_review` whose next score is at least 0.05 below `score_at_creation`;
    - every persona password verifies against `settings.demo_password`.
  - `test_seed_deterministic`: two seeds produce identical persona ids and identical risk scores for 10 people.
  - `test_reset_removes_visitor_rows_and_restores_seeded`:
    - Insert a non-seeded check-in and plan.
    - Mark a seeded open plan done.
    - Set `last_reset` to 25 h ago.
    - After `maybe_reset` returns True, the visitor rows are gone, the seeded plan is back to open, and that person's `record` matches the seed.
  - `test_reset_regenerates_on_new_quarter`: call `maybe_reset` with `now` 100 days later. The quarters now end at the new current quarter, and the personas still satisfy their stories.
  - `test_maybe_reset_noop_within_24h`.
  - Update `test_seed_loads_everyone`: Employee 1004's `risk_score` now equals its latest check-in's score, not the OOF. Keep the 1,470 count, and add `is_current` count == 1233.
- [ ] **Step 2: Run them.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_seed.py tests/api/test_demo.py -q`
  - Expected: FAIL.
- [ ] **Step 3: Implement `names.py`, `demo.py` and the `seed.py` changes, and wire the lifespan into `api/main.py`.**
- [ ] **Step 4: Run them, then time the seed.**
  - Run the tests. Expected: PASS.
  - Run: `.venv/Scripts/python -m api.seed`
  - Expected: prints a seconds count under 60.
- [ ] **Step 5: Commit** with message `feat(api): seeded quarterly history, personas and daily demo reset`.

### Task 6: Employee API

**Files:**
- Create: `api/routes/me.py`, `api/checkins.py` (`submit_checkin(db, employee, answers, keep_me, comment, today) -> CheckIn`, which rescores the employee).
- Modify: `api/schemas.py` (employee-side schemas).
- Test: `tests/api/test_me.py`.

**Interfaces:**
- Consumes: `EmployeeUser`, `require_same_origin`, Task 2, Task 3 and `quarter_of`.
- Produces these routes:
  - `GET /api/me` returns:
    - `displayName`, `department`, `jobRole`;
    - `quarter` (current);
    - `checkInStatus` (`"open"` or `"done"`);
    - `keepMe` (latest list), `keepMeOptions` (`[{key,label}]`) and `comment` (latest or null);
    - `updates` (this department's `[{quarter, said, did}]`, newest first, at most 8);
    - `history` (`[{quarter, answers (camelCase keys), keepMe, comment}]`, newest first).
  - `GET /api/me/check-in` returns `{quarter, notice, questions:[{key, label, kind:"scale"|"yesno"|"travel"|"count", options:[{value,label}]}], current: answers|null}`. `notice` is the verbatim string.
  - `POST /api/me/check-in` takes `{answers:{8 camelCase keys}, keepMe:[≤3 keys], comment:str≤500}` and returns 201 `{quarter, status:"done"}`.
- None of these routes return any score field.

- [ ] **Step 1: Write the failing tests.**
  - `test_me_never_exposes_scores`: recursively walk the JSON of all three endpoints (plus the POST response). No forbidden key from Global Constraints appears.
  - `test_checkin_rescores_employee`: after a POST, `Employee.risk_score` equals `score_frame` of the new effective features, and the row's quarter is current.
  - `test_resubmit_same_quarter_replaces`: two POSTs leave one row for the quarter, holding the second answers.
  - `test_checkin_validation`: a scale of 5 gives 422; 4 keep-me keys give 422; an unknown keep-me key gives 422; a 501-character comment gives 422.
  - `test_notice_verbatim`.
  - `test_me_requires_login`: 401.
  - `test_checkin_rate_limit`: the 11th POST in an hour returns 429.
- [ ] **Step 2: Run them.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_me.py -q`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(api): employee check-in and home endpoints`.

### Task 7: HR API (and removing the public data routes)

**Files:**
- Create: `api/routes/hr.py` (split into `hr_dashboard.py`, `hr_people.py` and `hr_checkins.py` if the file passes about 250 lines).
- Modify: `api/schemas.py`, `api/main.py`.
- Delete: `api/routes/employees.py`, `api/routes/workforce.py`, `api/routes/model.py`, and their tests.
- Move reusable helpers first: the heatmap, top drivers, cost and hypotheses into `api/insights.py`.
- Test: `tests/api/test_hr.py`.

**Interfaces:**
- Consumes: `HrUser`, Tasks 2, 3 and 6, and `apply_action`.
- Produces these routes. All are camelCase, and all exclude former staff.
  - `GET /api/hr/dashboard?replacementPct=50` returns:
    - `quarter`, `headcount`, `highRisk`;
    - `costAtStake`;
    - `meanRisk` and `meanRiskPrev` (the last closed quarter);
    - `responseRate`;
    - `sharpDrops`: `[{id, name, department, jobRole, fields:[...], riskScore, prevRiskScore}]`, sorted by risk rise;
    - `heatmap` (same shape as today);
    - `keepThemes`: `[{department, n, top:[{key,label,share}]}]`, where a department with n<5 this quarter gets `top: []` and `hidden: true`;
    - `trust`: `{rocAuc, prAuc, recall, precision, threshold, fairness: [...]}`, from metrics.json.
  - `GET /api/hr/people?search=&department=&band=&limit=50&offset=0` returns `{items:[{id,name,department,jobRole,riskScore,riskBand,trend:"up"|"down"|"flat",answered:bool}], total}`, sorted by risk descending.
  - `GET /api/hr/people/{id}` returns:
    - card fields plus `name`;
    - `drivers` and `levers` (the current effective values);
    - `riskHistory`: `[{quarter, riskScore}]`;
    - `checkIns`: `[{quarter, answers, keepMe, comment, submittedAt}]`;
    - `change` (the `change_sentence`, or null);
    - `plans`: `[{id, action, label, note, status, createdQuarter, scoreAtCreation, estimatedScore, actualChange|null}]`.
    - It returns 404 for unknown or former staff.
  - `POST /api/hr/simulate` takes `{employeeId, levers}` and returns `{before, after, delta, beforeBand, afterBand, drivers}`. It is the old simulate, now gated, and starts from the effective features.
  - `POST /api/hr/people/{id}/plans` takes `{action, note?}` and returns 201 with the plan. The estimate is `score_frame(apply_action(effective))`.
  - `PATCH /api/hr/plans/{id}` takes `{status:"done"}`, applies the lever into `record`, rescores, and returns the plan.
  - `GET /api/hr/check-ins` returns `{quarter, responseRate, byDepartment:[{department, answered, total}], missing:[{id,name,department,jobRole}], updates:[{id,department,quarter,said,did}]}`.
  - `POST /api/hr/updates` takes `{department, said, did}` and returns 201.
- `actualChange` is the first check-in score after `done_at` minus `score_at_creation`, or null.

- [ ] **Step 1: Write the failing tests.**
  - `test_role_gates`:
    - every `/api/hr/*` route returns 401 when signed out and 403 for an employee;
    - every `/api/me/*` route returns 403 for HR.
  - `test_dashboard_numbers`:
    - `headcount == 1233`;
    - `costAtStake` equals the formula computed in the test;
    - departments with fewer than 5 answers have `hidden`.
  - `test_sharp_drop_persona_listed`.
  - `test_person_page_contents`: the plan_worked persona has a done pay_review with a negative `actualChange`, and `riskHistory` has 4 points.
  - `test_former_staff_404`.
  - `test_plan_done_applies_lever`: marking a plan done raises `record["MonthlyIncome"]` by 10% and changes `risk_score`.
  - `test_update_validation`: a 281-character `said` gives 422.
  - `test_people_search`: searching the persona's surname finds them.
- [ ] **Step 2: Run them.**
  - Run: `.venv/Scripts/python -m pytest tests/api/test_hr.py -q`
  - Expected: FAIL.
- [ ] **Step 3: Implement it, and delete the old public routes and their tests.**
- [ ] **Step 4: Run the full Python suite.**
  - Run: `.venv/Scripts/python -m pytest -q` and `.venv/Scripts/ruff check .`
  - Expected: all pass, ruff clean.
- [ ] **Step 5: Commit** with message `feat(api): HR dashboard, people, plans, check-in status; remove public data routes`.

### Task 8: Web plumbing (same-origin proxy, auth client, route guard)

**Files:**
- Create:
  - `web/src/app/api/[...path]/route.ts`;
  - `web/src/lib/upstream.ts` (pure: `buildUpstream(req: Request, apiOrigin: string, secret: string, clientIp: string | null): Request`);
  - `web/src/proxy.ts`;
  - `web/src/lib/session.ts` (client: `useSession()` calls `/api/auth/me`).
- Modify:
  - `web/src/lib/api.ts`: base `""`; replace the old endpoints with typed HR, `me` and auth calls whose shapes mirror Tasks 6–7. Drop `listEmployees`, `getWorkforce`, `saveScenario` and the rest.
  - `web/next.config.ts`: replace the `NEXT_PUBLIC_API_URL` guard with a production guard that requires `API_ORIGIN`.
  - `web/Dockerfile`: ARG/ENV `API_ORIGIN`, removing `NEXT_PUBLIC_API_URL`.
  - `.env.example`: `API_ORIGIN`, `PROXY_SECRET`, `SITE_ORIGINS`, `COOKIE_SECURE`, `DEMO_PASSWORD`.
  - `web/playwright.config.ts`: the web server env gets `API_ORIGIN=http://localhost:8010`.
- Test: `web/src/lib/upstream.test.ts`, `web/src/lib/api.test.ts` (update).

**Interfaces:**
- Produces:
  - The route handler forwards GET, POST, PATCH and DELETE to `${API_ORIGIN}/api/${path}${search}`.
    - It forwards the method, body, `content-type`, `cookie` and `origin`.
    - It adds `x-retain-client-ip` (first hop of the incoming `x-forwarded-for`) and `x-retain-proxy-secret` (`PROXY_SECRET`).
    - It returns the upstream status and body, and passes every `set-cookie` header through unchanged, using `headers.getSetCookie()`.
    - It returns 502 `{"detail":"Can't reach the model right now."}` on a network error.
  - `proxy.ts` matches `/hr/:path*`, `/me/:path*` and `/login`.
    - A missing `retain_session` cookie on `/hr` or `/me` redirects to `/login?next=<path>`.
    - The cookie present on `/login` lets the request through; the page itself redirects after `/api/auth/me`.

- [ ] **Step 1: Write the failing tests.**
  - `buildUpstream` copies the method, path, query, cookie and origin.
  - It sets both `x-retain-*` headers.
  - It drops `host`.
  - It never forwards an incoming `x-retain-proxy-secret` from the client: the secret always comes from the env.
- [ ] **Step 2: Run them.**
  - Run (in `web/`): `npx vitest run src/lib/upstream.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.** Delete `NEXT_PUBLIC_API_URL` usages, and use `src/proxy.ts` per the Next 16 docs.
- [ ] **Step 4: Run the checks.**
  - Run: `npx vitest run && npx tsc --noEmit && npx eslint`
  - Expected: pass. The landing page still renders through `npm run dev`. Pages being deleted in Task 9 may fail type-checking until then, so delete them in this task if that blocks `tsc`.
- [ ] **Step 5: Commit** with message `feat(web): same-origin API proxy, session client, route guard`.

### Task 9: Login page, landing changes, nav, and removing the public pages

**Files:**
- Create: `web/src/app/login/page.tsx`, `web/src/components/auth/LoginForm.tsx`, `web/src/components/site/AppNav.tsx` (signed-in header: logo, area links, display name, Sign out).
- Modify:
  - `web/src/app/page.tsx` and the landing components: every call to action goes to `/login` and reads "Sign in". Remove LiveDemo and any section that calls removed endpoints. Keep Hero, About, BeforeAfter (static numbers inlined from metrics at build time is fine), QuestionsCarousel and ContactSection.
  - `web/src/lib/site.ts`: nav becomes `[{href:"/login", label:"Sign in"}]`; `email` stays a constant the owner can change.
  - `web/src/components/site/Nav.tsx`.
- Delete:
  - `web/src/app/explore`, `web/src/app/workforce`, `web/src/app/honesty` and `web/src/app/s`;
  - `web/src/components/share`;
  - any component left unused. Components reused later (Heatmap, DriverBars, LeverPanel, Simulator, RiskGauge, BandChip, FairnessTable, CalibrationPlot) move to `web/src/components/hr/`.
- Test: `web/e2e/auth.spec.ts`; delete `explore.spec.ts` and `insights.spec.ts`; update `landing*.spec.ts` and `resilience.spec.ts`.

**Interfaces:**
- Login page:
  - An email and password form.
  - Under it, a "Demo accounts" list of 5 buttons from a constant `DEMO_ACCOUNTS` in `site.ts`: `{email, label}` where `label` is like "Priya Shah · HR manager". Each button fills the form and submits it.
  - On success, go to `next` if it starts with the user's home, otherwise to `home`.
  - Errors show inline with `role="alert"`.
  - A line under the buttons: "All people and data here are fictional."
- No string anywhere contains "Try".

- [ ] **Step 1: Write the failing e2e tests.**
  - `hr demo button lands on /hr`.
  - `employee demo button lands on /me`.
  - `wrong password shows inline error`.
  - `signed-out /hr redirects to /login`.
  - `employee visiting /hr is sent to /me` (the HR page shows the 403 state by redirecting to the user's home).
  - `no page says Try`: visit `/`, `/login`, `/hr`, `/hr/check-ins` and `/me` as the right users, and assert that `page.locator('body')` text does not match `/\bTry\b/i`.
- [ ] **Step 2: Run them.**
  - Run (in `web/`): `npx playwright test e2e/auth.spec.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the checks.**
  - Run: `npx playwright test e2e/auth.spec.ts e2e/landing.spec.ts e2e/landing-interactive.spec.ts`
  - Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): sign-in page, landing CTAs to sign in, remove public data pages`.

### Task 10: HR dashboard (`/hr`)

**Files:**
- Create: `web/src/app/hr/layout.tsx` (AppNav with Dashboard and Check-ins links; redirects non-HR users to their home), `web/src/app/hr/page.tsx`, and `web/src/components/hr/Dashboard.tsx` plus focused section components: `KpiStrip`, `CostAtStake` (with the replacement-percentage slider), `SharpDrops`, `PeopleTable` (search, department filter, band chips, paging), `KeepThemes` and `TrustPanel`. Reuse the existing `Heatmap`.
- Test: `web/e2e/hr.spec.ts`.

**Interfaces:**
- Consumes `getDashboard(replacementPct)` and `listPeople(params)` from `api.ts`.
- Section order:
  1. KPIs (headcount, high risk, cost at stake, average risk with an arrow versus last quarter, response rate).
  2. Sharp drops since last check-in.
  3. People at risk.
  4. Where risk concentrates.
  5. What would keep people here.
  6. Can you trust these scores?
- Rows link to `/hr/people/[id]`.
- Motion: the existing `Reveal` and `AnimatedNumber`; no new libraries.
- Keep the dataviz rules already used (validated palette, legends, table fallback for the heatmap).

- [ ] **Step 1: Write the failing e2e tests.**
  - As HR: the dashboard shows "Sharp drops since last check-in", and the sharp_drop persona's name is in that section.
  - The cost at stake changes when the slider moves.
  - Searching the stable persona's surname filters the table to them.
  - Clicking a row opens `/hr/people/<id>`.
- [ ] **Step 2: Run them.**
  - Run: `npx playwright test e2e/hr.spec.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run the checks.**
  - Run: `npx playwright test e2e/hr.spec.ts && npx tsc --noEmit`
  - Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): HR dashboard`.

### Task 11: HR person page (`/hr/people/[id]`)

**Files:**
- Create: `web/src/app/hr/people/[id]/page.tsx` (Suspense boundary around `useParams`, as in Phase B), `web/src/components/hr/PersonView.tsx`, `RiskHistory.tsx` (a hand-built SVG line with 4 points, the threshold line, hover tooltip, and table fallback), `CheckInAnswers.tsx` (quarters × questions grid, changed cells marked), `ActionPlans.tsx`. Reuse `Simulator` and `LeverPanel` in their moved form, now calling `/api/hr/simulate`.
- Test: extend `web/e2e/hr.spec.ts`.

**Interfaces:**
- Consumes: `getPerson`, `simulate`, `createPlan`, `markPlanDone`.
- Order:
  1. Header (name, role, department, band, score).
  2. The `change` sentence.
  3. What's driving it (drivers with values).
  4. Risk over quarters.
  5. Check-in answers.
  6. What would keep them here.
  7. Action plans: a picker of the 7 actions, showing an estimate as "Model's estimate: 34% → 27%", with "Mark done" and the actual change or "Waiting for next check-in".
  8. What-if.

- [ ] **Step 1: Write the failing e2e tests.**
  - The plan_worked persona shows a done pay review with an actual change that reads as a fall.
  - Creating a "Reduce overtime" plan for the sharp_drop persona shows the estimate line.
  - Marking it done updates the header score.
  - The `change` sentence is visible for the sharp_drop persona.
- [ ] **Step 2: Run them.**
  - Run: `npx playwright test e2e/hr.spec.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): HR person page with plans and what-if`.

### Task 12: HR check-ins page (`/hr/check-ins`)

**Files:**
- Create: `web/src/app/hr/check-ins/page.tsx`, `web/src/components/hr/CheckInStatus.tsx`, `web/src/components/hr/UpdateComposer.tsx`.
- Test: extend `web/e2e/hr.spec.ts`.

**Interfaces:**
- Shows: the response rate, department bars (answered/total, labelled with counts), the list of people who haven't responded (linking to their person page), and "You said, we did". The composer has a department select and "You said" / "We did" fields with live character counts (280), and the posted update appears at the top.
- Consumes `getCheckIns()` and `postUpdate()`.

- [ ] **Step 1: Write the failing e2e tests.**
  - The not_answered persona is listed under people who haven't responded.
  - Posting an update shows it at the top of the list.
  - Signing in as an employee of that department shows it on `/me`. Put this in Task 13's spec if run order needs it.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): HR check-in status and you-said-we-did composer`.

### Task 13: Employee home and check-in (`/me`, `/me/check-in`)

**Files:**
- Create: `web/src/app/me/layout.tsx` (AppNav; redirects HR users to `/hr`), `web/src/app/me/page.tsx`, `web/src/app/me/check-in/page.tsx`, `web/src/components/me/Home.tsx`, `CheckInFlow.tsx` and `Question.tsx`.
- Test: `web/e2e/me.spec.ts`.

**Interfaces:**
- `/me` sections:
  - this quarter's status card (open: "Start this quarter's check-in"; done: "Done for {quarter}. You can update it until the quarter ends.");
  - What would keep you here (latest picks);
  - You said, we did;
  - Your past answers.
- `CheckInFlow`:
  - The notice, verbatim, at the top of step 1.
  - One question per screen, with large tap targets. The 1–4 options use the labels from the API, and keyboard arrows move between options.
  - The last step is "What would keep you here" (up to 3 chips plus a comment with a 500-character count).
  - Back and Next buttons; Submit goes to `/me` with the done state.
  - Step transitions: opacity plus `translateX` with ease-out, 200 ms, and fade only under reduced motion.

- [ ] **Step 1: Write the failing e2e tests.**
  - As not_answered: `/me` shows the open state.
  - Completing all 9 steps and submitting returns to `/me` in the done state, with the picks shown.
  - The notice text is present verbatim.
  - No text on `/me` or `/me/check-in` matches `/\d+%|risk/i`.
- [ ] **Step 2: Run them.**
  - Run: `npx playwright test e2e/me.spec.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): employee home and quarterly check-in flow`.

### Task 14: Drifting-people hero

**Files:**
- Modify: `web/src/components/landing/HeroHaze.tsx` (rename to `HeroCrowd.tsx`), `web/src/components/landing/Hero.tsx` (remove the ellipse SVG).
- Test: `web/e2e/landing-interactive.spec.ts`.

**Interfaces:**
- The canvas draws 1,233 small person dots on desktop and 400 below 768 px, in a loose crowd laid out by a seeded jittered grid inside a soft ellipse mask. They use the existing particle tokens.
- Every 4 s, 3–6 random dots turn coral (the existing accent) and drift outward along a curved path over about 1.6 s. They pause, then ease back in over about 1.2 s and return to the base colour.
- The cursor repels dots within 80 px with a spring-like ease back.
- The animation pauses when off-screen (IntersectionObserver) or when the tab is hidden.
- Under `prefers-reduced-motion`, draw a single static frame.
- `aria-hidden`. No new dependency.

- [ ] **Step 1: Write the failing test.** The hero no longer contains an `ellipse` element, and the canvas `[data-hero-crowd]` exists and has non-zero size.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run it, then feel-check.**
  - Run the test. Expected: PASS.
  - Screenshot it at 1440 and 390 widths, and look at it.
- [ ] **Step 5: Commit** with message `feat(web): drifting-people hero`.

### Task 15: Locally built images and the deploy path

**Files:**
- Modify:
  - `api/Dockerfile`: keep training in the image. It now runs on the owner's machine; the base stays python:3.12-slim and `xgboost-cpu` comes in via requirements.
  - `web/Dockerfile`: `API_ORIGIN` build arg.
  - `scripts/deploy_render.py`: switch to `runtime: "image"` services pulling `ghcr.io/aniruddhasgit/retain-api:<tag>` and `ghcr.io/aniruddhasgit/retain-web:<tag>`, with `autoDeploy: "no"`. Env:
    - API: `DATABASE_URL`, `IP_HASH_SALT`, `PROXY_SECRET`, `SITE_ORIGINS`, `COOKIE_SECURE=true`, `DEMO_PASSWORD`.
    - Web: `API_ORIGIN`, `PROXY_SECRET`.
  - `README.md`: the deploy section and "open the site a minute before a demo".
- Create: `scripts/build_images.sh`. It runs `docker buildx build --platform linux/amd64` for both images with tag `git rev-parse --short HEAD`, then `docker push`.
- Test: `tests/test_deploy_script.py`, a pure unit test of the payload builder.

**Interfaces:**
- `deploy_render.py` gains `service_payload(name: str, image: str, env: dict, owner: str) -> dict`.

- [ ] **Step 1: Write the failing test.** The payload has `runtime == "image"`, `image.imagePath` equal to the given tag, `autoDeploy == "no"`, `plan == "free"`, `region == "singapore"`, and no `repo` key.
- [ ] **Step 2: Run it.**
  - Run: `.venv/Scripts/python -m pytest tests/test_deploy_script.py -q`
  - Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - Build both images locally with `scripts/build_images.sh` without pushing (`PUSH=0`).
  - Run the API image against local Postgres with the web image pointed at it.
  - Sign in as HR and as an employee on `http://localhost:3000`.
- [ ] **Step 4: Run the full suites.**
  - Run: `.venv/Scripts/python -m pytest -q`, `ruff check .`, and in `web/`: `npx vitest run`, `npx tsc --noEmit`, `npx eslint`, `npx playwright test`.
  - Expected: all pass.
- [ ] **Step 5: Commit** with message `chore: locally built images and image-based Render deploy`.
- [ ] **Step 6: STOP and hand the owner the exact commands.** This step changes the owner's GitHub token scopes and Render account, so the owner runs it or explicitly approves it:
  - `gh auth refresh -s write:packages`;
  - `scripts/build_images.sh` (pushes);
  - make both GHCR packages public;
  - `python scripts/deploy_render.py`. This recreates the two Retain services as image services inside the Retain project; delete the old repo-built ones first.
  - Then merge `feat/accounts` into `main`.
