# Phase B — Retain web app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A locally running, free-to-host web app — FastAPI + PostgreSQL API serving the Phase A artifacts, and a motion-rich Next.js site in the editorial style of the reference — with the eight features in the spec.

**Architecture:** `api/` is a FastAPI package that loads `models/` once at startup and reads/writes Postgres via SQLAlchemy 2 (Alembic migrations, a seed script). `web/` is a Next.js App Router app (TypeScript, Tailwind v4, Motion) that calls the API through one typed client. `docker-compose.yml` runs db + api + web; `DATABASE_URL` is the only DB coupling, so native PG 18, Neon/Supabase or RDS swap in by config.

**Tech Stack:** Python 3.12, FastAPI 0.143, SQLAlchemy 2.1, Alembic 1.20, psycopg 3.3, pydantic-settings, uvicorn, httpx (tests) · Next.js 16.4, React 19, TypeScript, Tailwind CSS 4.3, motion 14.3, Recharts 3.10 (via dataviz skill guidance), Vitest 5, Playwright 1.64 · Docker Compose, postgres:18.

**Spec:** `docs/superpowers/specs/2026-10-18-retain-design.md` · Phase A artifacts: `models/` (`metrics.json`, `oof.parquet`, `drivers.parquet`, `fold_{0..4}.joblib`, `refit.joblib`).

## Global Constraints

- Free forever: no paid services; API < 512 MB RAM; no background workers/queues.
- Ports: Postgres **5433** (5432 is the native PG 18 install), API **8010** (8000 is taken), web **3000**.
- Config only via env: `DATABASE_URL`, `IP_HASH_SALT`, `CORS_ORIGINS`, `MODELS_DIR`, `NEXT_PUBLIC_API_URL`. `.env` gitignored; `.env.example` lists names with local-dev defaults only (no real secrets).
- Displayed risk scores are ALWAYS the out-of-fold `risk_score` from `oof.parquet`; `/simulate` uses the employee's own fold model. `refit.joblib` is never used for dataset employees.
- Protected attributes (`Gender`, `Age`, `MaritalStatus`) are never levers and never shown on person cards; they appear only on the fairness view.
- Copy: "risk score" / "P(leave)", never "confidence". SHAP impact shown as relative bars, never as percentages. Every score view carries: "Fictional IBM data · patterns, not verdicts on people."
- Simulator levers (exactly): `OverTime` (Yes/No), `MonthlyIncome` (1,000–20,000 step 100), `StockOptionLevel` (0–3), `JobLevel` (1–5), `TrainingTimesLastYear` (0–6), `BusinessTravel` (Non-Travel/Travel_Rarely/Travel_Frequently), `YearsSinceLastPromotion` (0–15).
- Cost lens default replacement cost = 50% of annual salary (`MonthlyIncome × 12`), editable 10–200%, labelled "assumption".
- Motion: every animation has a `prefers-reduced-motion` fallback (opacity only; hero haze static). Durations ≤ 600 ms for UI, story/scroll sequences may be longer. Use the `animate`, `motion-react`, `emil-design-eng`, `impeccable`/`design-taste-frontend` and `dataviz` skills when building the web tasks.
- Look: off-white `#F4F5F6` background, ink `#0E1116`, slate/blue-grey accents (`#5B6B7A`, `#9AA8B5`, `#C9D3DC`), dark footer `#1B2430`; one grotesk family (Inter Tight or similar via `next/font`); 1px hairlines; `rounded-xl` cards; pill buttons with a black circle arrow.
- Responsive at 375 px and 1440 px; no horizontal scroll; Lighthouse accessibility ≥ 95 on `/`.
- Branch `feat/web-app` (from `chore/github-ready`). No push, no remote.
- Stop and ask before deleting files.

## Review Focus

- Simulating an employee ID that doesn't exist, or a lever value out of range → 404 / 422 with a readable message, never 500 → `test_simulate_unknown_employee_404`, `test_simulate_out_of_range_422` (Task 3).
- Contact form spam: honeypot filled, or > 5 posts per IP per hour → accepted-looking 200 for honeypot (nothing stored), 429 for rate limit → `test_contact_honeypot_not_stored`, `test_contact_rate_limited` (Task 5).
- API down / slow while browsing the site → pages show a calm inline error state, not a blank screen → Playwright `api-down.spec.ts` (Task 11).
- Reduced-motion users → no transforms on hero/scroll sections → Playwright `reduced-motion.spec.ts` (Task 11).
- Shared scenario link with a bad id → friendly 404 page → `test_scenario_unknown_404` (Task 5) + page `not-found.tsx` (Task 11).

---

### Task 1: Database, API skeleton, migrations

**Files:** Create `docker-compose.yml` (service `db`: postgres:18, port 5433:5432, volume `pgdata`, healthcheck), `api/__init__.py`, `api/settings.py`, `api/db.py`, `api/models.py`, `api/main.py`, `api/alembic.ini`, `api/migrations/` (env.py + first revision), `tests/api/conftest.py`, `tests/api/test_health.py`; modify `requirements.in` (+ fastapi, uvicorn[standard], sqlalchemy, alembic, psycopg[binary], pydantic-settings, httpx), `.env.example`, `Makefile` (`db-up`, `migrate`, `seed`, `api`).

**Interfaces — Produces:**
- `api.settings.Settings` (pydantic-settings): `database_url: str = "postgresql+psycopg://retain:retain@localhost:5433/retain"`, `ip_hash_salt: str = "dev-only-salt"`, `cors_origins: list[str] = ["http://localhost:3000"]`, `models_dir: Path = ROOT/"models"`; `get_settings()` cached.
- `api.db`: `engine`, `SessionLocal`, `get_session()` FastAPI dependency.
- `api.models` (SQLAlchemy 2 typed): `Employee(employee_id PK int, department, job_role, job_level, years_at_company, monthly_income, overtime, features JSONB, risk_score float, risk_band str, drivers JSONB, attrition int, fold int)`, `ModelRun(id, version, metrics JSONB, threshold, created_at)`, `Scenario(id, public_id str unique (10-char urlsafe), employee_id FK, levers JSONB, before float, after float, created_at)`, `ContactMessage(id, name, email, message, consent bool, ip_hash, created_at)`.
- `api.main.app` with `GET /api/health -> {"status":"ok","db":true,"model_version":str}`.
- Test DB: `retain_test` on the same server; `tests/api/conftest.py` creates schema via `Base.metadata.create_all`, yields `client` (httpx `TestClient`) with the session overridden; truncates tables per test.

- [ ] Step 1: `docker compose up -d db`; wait for healthy. Write `test_health_ok` (200, `db is True`). Run → FAIL (no module).
- [ ] Step 2: Implement settings/db/models/main; Alembic revision `0001_initial` autogenerated from models; `alembic upgrade head` against `retain`.
- [ ] Step 3: Run `pytest tests/api -q` → PASS; `alembic current` shows head.
- [ ] Step 4: Commit `feat(api): postgres via compose, models, migrations, health`.

### Task 2: Seed + model service

**Files:** Create `api/seed.py` (`python -m api.seed`), `api/service.py`, `tests/api/test_seed.py`.

**Interfaces — Produces:**
- `api.service.ModelService` (singleton via `get_service()`, loaded in app lifespan): `.metrics: dict`, `.threshold: float`, `.fold_model(k) -> model` (lazy-loaded, cached), `.score_row(employee: Employee, overrides: dict) -> tuple[float, list[dict]]` (uses `ml.explain.top_drivers` with the employee's fold model; returns calibrated P(leave) and drivers), `.band(p) -> "low"|"elevated"|"high"` (low < threshold·0.6 ≤ elevated < threshold ≤ high).
- `api.seed.run(session, models_dir) -> int` loads `ml.data.load_raw()`, joins `oof.parquet` + `drivers.parquet`, upserts 1,470 `Employee` rows (features JSON = the 27 FEATURES only) and one `ModelRun` from `metrics.json`; idempotent.

- [ ] Step 1: Tests: `test_seed_loads_everyone` (count 1470, employee 1004 risk equals `oof.parquet` value to 4 dp, `features` has no protected keys); `test_seed_idempotent` (run twice → still 1470, 1 model run); `test_band_edges` (band(threshold) == "high", band(0) == "low"). Run → FAIL.
- [ ] Step 2: Implement. Step 3: PASS. Run `python -m api.seed` against dev DB → prints `seeded 1470 employees`.
- [ ] Step 4: Commit `feat(api): seed employees and model run, model service`.

### Task 3: Employees, simulate, model metrics endpoints

**Files:** Create `api/routes/employees.py`, `api/routes/model.py`, `api/schemas.py`; Test `tests/api/test_employees.py`, `tests/api/test_model.py`.

**Interfaces — Produces (JSON, camelCase via pydantic alias generator):**
- `GET /api/employees?department=&jobRole=&band=&sort=risk|id&limit=24&offset=0` → `{items: EmployeeCard[], total}`; `EmployeeCard = {id, department, jobRole, jobLevel, yearsAtCompany, monthlyIncome, overTime, riskScore, riskBand, drivers: Driver[]}` (no protected fields).
- `GET /api/employees/random` → `EmployeeCard` (optional `band`).
- `GET /api/employees/{id}` → `EmployeeCard & {levers: Levers}` — current lever values.
- `POST /api/simulate {employeeId, levers: Partial<Levers>}` → `{before, after, delta, beforeBand, afterBand, drivers: Driver[]}`; `before` == stored `riskScore` (± 1e-6) when `levers` is empty.
- `GET /api/model/metrics` → `{version, threshold, nTest, nTestPos, before, after, thresholdCurve, calibration, fairness}` straight from `ModelRun.metrics`.
- `Driver = {feature, value, impact, direction, text}`.

- [ ] Step 1: Tests: `test_list_filters_and_sorts` (band=high all ≥ threshold; sort=risk descending), `test_card_has_no_protected_fields`, `test_simulate_noop_matches_stored`, `test_simulate_overtime_off_lowers_risk_for_1004` (1004 works overtime; after < before), `test_simulate_unknown_employee_404`, `test_simulate_out_of_range_422` (MonthlyIncome 999999), `test_metrics_endpoint`. Run → FAIL.
- [ ] Step 2: Implement (lever bounds from Global Constraints as pydantic `Field(ge, le)` / `Literal`). Step 3: PASS.
- [ ] Step 4: Commit `feat(api): employees, simulator, metrics endpoints`.

### Task 4: Workforce map, cost lens, hypotheses

**Files:** Create `api/routes/workforce.py`, `api/content.py`; Test `tests/api/test_workforce.py`.

**Interfaces — Produces:**
- `GET /api/workforce/summary?replacementPct=50` → `{headcount, leavers, meanRisk, expectedLeavers (Σ risk), expectedCost (Σ risk × income×12 × pct/100), distribution: [{bin (0.0–0.95 step 0.05), count}], heatmap: [{department, jobRole, n, meanRisk, expectedCost}], topDrivers: [{feature, text, share}]}`.
- `GET /api/workforce/compare?a.department=Sales&b.department=Research%20%26%20Development` (filters: department, jobRole, overTime, jobLevel; prefix `a.`/`b.`) → `{a: SegmentStats, b: SegmentStats}`; `SegmentStats = {label, n, attritionRate, meanRisk, expectedCost, topDrivers}`. Segments with n < 10 return `{..., smallSample: true}`.
- `api.content.HYPOTHESES: dict[str, {title, body}]` for the 7 levers + `JobSatisfaction`, `EnvironmentSatisfaction`, `WorkLifeBalance`, `DistanceFromHome`, `YearsWithCurrManager`; `GET /api/hypotheses` returns them. Copy is framed "worth testing", no costs.

- [ ] Step 1: Tests: `test_summary_totals` (headcount 1470, leavers 237, Σ distribution = 1470, expectedCost scales linearly: pct=100 is 2× pct=50), `test_compare_segments`, `test_compare_small_sample_flag`, `test_hypotheses_cover_levers`. Run → FAIL.
- [ ] Step 2: Implement with SQL aggregates where simple, pandas over the cached employee frame otherwise. Step 3: PASS.
- [ ] Step 4: Commit `feat(api): workforce map, segment compare, cost lens, hypotheses`.

### Task 5: Scenarios + contact

**Files:** Create `api/routes/scenarios.py`, `api/routes/contact.py`, `api/ratelimit.py`, `api/scripts/messages.py`; Test `tests/api/test_scenarios.py`, `tests/api/test_contact.py`.

**Interfaces — Produces:**
- `POST /api/scenarios {employeeId, levers}` → `{publicId}` (server recomputes before/after; never trusts client numbers). `GET /api/scenarios/{publicId}` → `{publicId, employee: EmployeeCard, levers, before, after, delta, createdAt}`.
- `POST /api/contact {name (1–80), email (EmailStr), message (10–2000), consent: true, website: "" (honeypot)}` → `{ok: true}`. Honeypot non-empty → `{ok: true}`, not stored. > 5 per IP-hash per hour → 429. `ip_hash = sha256(salt + ip)`.
- `api.ratelimit.allow(key: str, limit: int, window_s: int) -> bool` (in-process sliding window; documented as per-instance).
- `python -m api.scripts.messages [--limit 20]` prints recent messages.

- [ ] Step 1: Tests: `test_scenario_roundtrip`, `test_scenario_ignores_client_numbers`, `test_scenario_unknown_404`, `test_contact_stores_message`, `test_contact_requires_consent_422`, `test_contact_honeypot_not_stored`, `test_contact_rate_limited` (6th → 429), `test_ip_is_hashed`. Run → FAIL.
- [ ] Step 2: Implement; CORS middleware from settings. Step 3: PASS; `pytest -q` whole suite green.
- [ ] Step 4: Commit `feat(api): shareable scenarios, contact form with spam guards`.

### Task 6: Web scaffold, design tokens, API client

**Files:** Create `web/` via `npx create-next-app@16.4.2 web --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm --no-turbopack`; add `motion@14.3.0`, `recharts@3.10.1`, dev `vitest@5.0.5`, `@playwright/test@1.64.1`. Create `web/src/lib/api.ts`, `web/src/lib/format.ts`, `web/src/styles/tokens.css` (or `@theme` block in `globals.css`), `web/src/components/ui/{PillButton,ArrowCircle,Hairline,Tag,Disclaimer,Reveal}.tsx`, `web/src/components/site/{Nav,Footer}.tsx`, `web/src/app/layout.tsx`; Test `web/src/lib/format.test.ts`, `web/src/lib/api.test.ts`.

**Interfaces — Produces:**
- `api.ts`: typed functions mirroring Tasks 3–5 (`listEmployees`, `getEmployee`, `randomEmployee`, `simulate`, `getMetrics`, `getWorkforce`, `compareSegments`, `getHypotheses`, `saveScenario`, `getScenario`, `sendContact`), base URL from `NEXT_PUBLIC_API_URL`, throws `ApiError{status, message}`.
- `format.ts`: `pct(p, dp=0) -> "28%"`, `money(n) -> "$1.2M" / "$84K"`, `bandLabel(band)`, `bandColor(band)`.
- `<Reveal>`: whileInView fade/rise, reduced-motion → opacity only. `<PillButton href|onClick>` with rotating `<ArrowCircle>` on hover. `<Disclaimer/>` renders the fixed copy line.

- [ ] Step 1: Vitest tests: `pct(0.2834) === "28%"`, `money(1234567) === "$1.2M"`, `money(84000) === "$84K"`, `api.simulate` posts camelCase body and throws `ApiError` with status on 422 (mock `fetch`). Run `npm test` → FAIL.
- [ ] Step 2: Implement; tokens per Global Constraints; Inter Tight via `next/font`. Step 3: PASS; `npm run build` succeeds.
- [ ] Step 4: Commit `feat(web): scaffold, tokens, UI primitives, typed API client`.

### Task 7: Landing page — hero, about, before/after

**Files:** Create `web/src/components/landing/{HeroHaze (canvas), HeroTitle, ServiceIndex, About, BeforeAfter}.tsx`, `web/src/app/page.tsx`.

**Behaviour:** Hero: full-bleed blue-grey canvas particle haze drifting, gentle pointer parallax; huge split headline "PEOPLE / STAY" (letters rise with stagger); thin circle stroke drawing in; `//01 —— Predict`, `//02 —— Simulate`, `//03 —— Explain`, `//04 —— Retain` lines drawing; pill CTA "Open the explorer". About: statement heading with scroll-linked word colour fade (ink → grey), pill tags stagger. BeforeAfter: pinned scroll section reading `getMetrics()` — numbers tween from before → after values as the user scrolls, four bug cards slide in (leakage, no hold-out, zeroed categories, arbitrary threshold), caption "532 of 1,470 flagged → 43 of 294".

- [ ] Step 1: Playwright `landing.spec.ts`: hero headline visible; `//01`…`//04` present; before/after shows `0.964` and `0.790` after scrolling; no horizontal scroll at 375 px. Run → FAIL.
- [ ] Step 2: Implement (canvas pauses when off-screen / tab hidden; DPR-capped). Step 3: PASS.
- [ ] Step 4: Commit `feat(web): landing hero, about, before/after story`.

### Task 8: Landing page — live demo, questions carousel, contact, footer

**Files:** Create `web/src/components/landing/{LiveDemo, QuestionsCarousel, ContactSection}.tsx`, finish `Footer`.

**Behaviour:** LiveDemo: a random high-band employee card + one OverTime toggle and income slider; spring-animated risk bar and counting number via `/simulate`. QuestionsCarousel: drag/swipe cards ("Who is most at risk?", "Does overtime matter?", "What would a raise change?", "How sure is the model?") each answered with a real number from `getWorkforce()`/`getMetrics()`, animated stat. Contact: two-column underline form with consent + hidden honeypot, animated submit states (idle/sending/sent/error). Footer: dark slate, huge "Get in touch" wordmark revealing on scroll, GitHub/email links with arrow nudge.

- [ ] Step 1: Playwright: toggling overtime in LiveDemo changes the displayed risk; carousel advances by button and by drag; contact submit shows "sent" (API stubbed via `page.route`). Run → FAIL.
- [ ] Step 2: Implement. Step 3: PASS.
- [ ] Step 4: Commit `feat(web): live demo, questions carousel, contact, footer`.

### Task 9: Explorer + simulator (`/explore`, `/explore/[id]`)

**Files:** Create `web/src/app/explore/page.tsx`, `web/src/app/explore/[id]/page.tsx`, `web/src/components/explore/{PersonCard, DriverBars, LeverPanel, RiskGauge, ScenarioShare}.tsx`.

**Behaviour:** Grid of person cards (filters: department, band; shuffle button), layout-animated on filter change. Detail: big RiskGauge (animated arc + number tween), DriverBars (relative, raises = slate-dark, lowers = light), LeverPanel with the seven levers; debounced (200 ms) `/simulate`; before/after delta chip; "reset"; "Save & share" → `/s/{publicId}` link copied. Causality note under the panel.

- [ ] Step 1: Playwright: filter to high band shows only "High" chips; opening 1004 shows its stored score; switching OverTime to No lowers the number; save produces a `/s/` URL. Run → FAIL.
- [ ] Step 2: Implement. Step 3: PASS.
- [ ] Step 4: Commit `feat(web): employee explorer and what-if simulator`.

### Task 10: Workforce map + honesty page

**Files:** Create `web/src/app/workforce/page.tsx`, `web/src/components/workforce/{Heatmap, RiskDistribution, CostLens, SegmentCompare, Hypotheses}.tsx`, `web/src/app/honesty/page.tsx`, `web/src/components/honesty/{MetricsCI, ThresholdExplorer, CalibrationPlot, FairnessTable}.tsx`.

**Behaviour:** Workforce: department × role heatmap (cells fade in staggered; tooltip n / mean risk / expected cost), distribution histogram with threshold line, CostLens slider (replacement %) with counting total labelled "assumption", SegmentCompare two dropdown sets → side-by-side stats, Hypotheses accordion. Honesty ("How good is this, honestly?"): metric tiles with CI whiskers, threshold slider moving precision/recall + confusion matrix from `thresholdCurve`, calibration plot, fairness table with n and small-sample flag, limitations list.

- [ ] Step 1: Playwright: heatmap has a cell for Sales/Sales Executive; moving CostLens to 100% doubles the total; honesty page shows ROC-AUC 0.790 with "0.706–0.867"; threshold slider changes recall text. Run → FAIL.
- [ ] Step 2: Implement (follow the dataviz skill). Step 3: PASS.
- [ ] Step 4: Commit `feat(web): workforce map, cost lens, honesty page`.

### Task 11: Share page, resilience, containers, docs, verification

**Files:** Create `web/src/app/s/[id]/page.tsx`, `web/src/app/not-found.tsx`, `web/src/components/ui/ErrorState.tsx`, `api/Dockerfile`, `web/Dockerfile`, extend `docker-compose.yml` (api: 8010, web: 3000, api runs migrate+seed on start), `web/e2e/{api-down,reduced-motion}.spec.ts`; modify `README.md` (screenshots, `docker compose up`), `.github/workflows/ci.yml` (+ web job: `npm ci`, `npm test`, `npm run build`), `.env.example`.

- [ ] Step 1: Playwright `api-down.spec.ts` (all `/api/**` routes abort → explorer shows ErrorState text "Can't reach the model right now"), `reduced-motion.spec.ts` (emulate reduce → hero title has no transform), share page renders a saved scenario. Run → FAIL.
- [ ] Step 2: Implement. `docker compose up --build` → all three healthy; `curl localhost:8010/api/health` → `{"status":"ok","db":true,...}`; `localhost:3000` renders.
- [ ] Step 3: Full verification: `pytest -q`, `npm test`, `npm run build`, `npx playwright test`; screenshots of `/`, `/explore/1004`, `/workforce`, `/honesty` at 375 and 1440 into `docs/screenshots/`; Lighthouse a11y on `/` ≥ 95.
- [ ] Step 4: Commit `feat: share page, resilience, containers, docs`.
