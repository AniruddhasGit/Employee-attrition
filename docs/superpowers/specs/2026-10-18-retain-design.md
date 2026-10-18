# Retain — design

Date: 2026-10-18 · Owner: Aniruddha Jathar · Status: draft for approval

## Intent and why

The repo holds a working-but-flawed attrition notebook (XGBoost + SMOTE + SHAP on the IBM HR
Analytics dataset). It trains and scores the same rows, has no working evaluation, uses an
arbitrary 0.9 threshold and labels P(leave) as "confidence".

The owner wants (a) the repo GitHub-ready and (b) a motion-rich, editorial-agency-style website
that does more than predict. Hard product calls were delegated to an LLM council (5 advisors +
peer review, 2026-10-18). Its central finding, adopted here: **the showcase is judgment, not a
predictor.** The site's story is "we took a flawed analysis, found what was wrong, fixed it
honestly, and here is what the honest model can and cannot tell you." That one framing works as
a GitHub portfolio piece and as a consultancy-style demo.

## Goals

1. A reproducible, honestly evaluated model pipeline that a fresh clone can rebuild with one
   command, with tests guarding against leakage.
2. A local full-stack web app (`Retain`) with a striking editorial landing page and a small set
   of features that are each useful and understandable to a stranger.
3. Lots of motion — but every major animation carries meaning (numbers, risk, story progress),
   plus decorative atmosphere in the hero.
4. Local PostgreSQL now; configuration shaped so free-tier hosting later (AWS free tier or
   similar) is a config change, not a rewrite.

## Non-goals

- Not an internal HR tool: no auth, no roles, no real employee data.
- No AWS resources, no deploy pipeline beyond CI.
- No LLM features, no PDF/executive-brief generation, no schema mapper.

## Anti-goals (failure even if it "works")

- Any number on the site that comes from in-sample predictions.
- Dollar figures or interventions presented as facts or as causal.
- Fabricated testimonials or client logos.
- Visitors able to upload real employee data.
- Protected/immutable attributes (Gender, Age, MaritalStatus) used as model inputs or as levers.
- Motion that hurts readability or ignores `prefers-reduced-motion`.

## Constraints

- **Personal app that must run for free** (owner, 2026-10-18). No paid services, ever. Later
  hosting must fit free tiers: e.g. web on Vercel/Netlify free, API on a free container host,
  Postgres on a free managed Postgres (Neon/Supabase) or the AWS free tier — all reached through
  the same `DATABASE_URL`. So: API process must stay under ~512 MB RAM, cold-start in under
  ~30 s, no background workers or queues, model artifacts small enough to ship in the image.

- Windows 11 dev machine; Node 24, Python 3.12, Docker 29 available. Native PostgreSQL 18 is
  installed but not on PATH.
- Dataset: IBM HR Analytics Employee Attrition (fictional, 1,470 rows, ~16% attrition).
  Attribute it in the README; it is not real company data.
- The model is trained on fictional data: the site must say it demonstrates a *method*, and
  would need retraining on a real organisation's data.
- Branding is personal ("Retain" by Aniruddha Jathar). No Dynpro name or logo unless the owner
  later gets internal sign-off — **builder's call made on the owner's behalf; flag for review.**

## Decisions (made by the council / owner)

**Audience & end action.** Primary: GitHub visitors and prospective clients/employers.
By the bottom of the landing page a visitor has seen the before/after story, dragged one what-if
slider, and is offered: open the app, read the code (GitHub link), or send a message (contact form).

**Stack.**
- Frontend: Next.js (App Router, TypeScript, Tailwind v4) + Motion (motion.dev). Charts with
  BKLit/Recharts or hand-rolled SVG where more control is needed.
- Backend: FastAPI + SQLAlchemy 2 + Alembic + psycopg 3; loads the trained artifact at startup.
- DB: PostgreSQL via **Docker Compose** (`postgres:18`) as the default local path, so a clone
  runs with one command. `DATABASE_URL` env var, so the native PG 18 install or AWS RDS work
  unchanged.
- Dockerfiles for api and web; `docker-compose.yml` runs db + api + web.

**Model changes (Phase A).**
- Features: drop Gender, Age, MaritalStatus (and the constant columns). Keep them only for the
  fairness audit.
- Stratified train/test split (80/20, fixed seed). SMOTE only inside an imblearn Pipeline on
  training folds. Original hyperparameters as baseline.
- Evaluate on the held-out test set: ROC-AUC, PR-AUC, precision/recall/F1 at threshold,
  confusion matrix, calibration curve, with **bootstrap 95% CIs** (the test set has only ~47
  leavers, so point metrics are noisy).
- Threshold chosen on validation data (CV out-of-fold), maximising F1 by default; stored in
  artifact metadata.
- **Probability calibration** (builder's call): SMOTE inflates P(leave), and the cost lens sums
  probabilities, so wrap the pipeline in `CalibratedClassifierCV` (isotonic, falls back to
  sigmoid if folds are too small). The before/after story includes the calibration step.
- **Out-of-fold predictions** for every employee (5-fold stratified CV) are what the site
  displays, so no displayed score is in-sample.
- **What-if uses the fold models** (builder's call): save all 5 fold models plus each
  employee's fold assignment. `/simulate` scores the original and the modified row with the
  fold model that never saw that employee, so the simulator's "before" equals the card's score.
  A model refit on all data is also saved, for scoring rows not in the dataset (tests, future use).
- "Before" numbers: reproduce the original notebook's in-sample metrics exactly, saved alongside
  the honest ones, for the before/after story.
- Wording everywhere: "risk score" / "P(leave)", never "confidence".

## Features

1. **Before / After** (signature): a scroll-driven section showing the original notebook's
   inflated metrics morphing into the honest held-out ones, with the three bugs that explain the
   gap (leakage, no hold-out, arbitrary threshold).
2. **Employee explorer**: pick or shuffle an employee; a person card (role, department, tenure —
   no names) with the out-of-fold risk score, a risk band, and the top SHAP drivers in plain
   English ("works overtime", "no stock options").
3. **What-if simulator** (same screen as 2): sliders/toggles for actionable levers only —
   OverTime, MonthlyIncome, StockOptionLevel, JobLevel, TrainingTimesLastYear, BusinessTravel,
   YearsSinceLastPromotion reset. Live before/after score with an animated delta. Copy states
   this shows how the *model* responds, not what *causes* people to leave.
4. **Workforce map**: aggregate views from out-of-fold scores — department × job-role heatmap,
   risk distribution, top drivers per segment, filters, and a "compare two segments" mode
   (replaces the separate cohort explorer).
5. **Team cost lens**: segment-level expected annual attrition cost = Σ P(leave) × replacement
   cost, where replacement cost is an editable % of salary (default 50%, labelled as an
   assumption). Never per named person in headline form; labelled illustrative.
6. **Retention hypotheses**: for each actionable driver, a short static note of interventions
   worth testing (e.g. overtime → workload review). Framed as hypotheses, no cost ranking.
7. **"How good is this, honestly?"**: metrics with CIs, interactive threshold slider updating
   precision/recall and the confusion matrix, calibration plot, fairness slice by Gender and age
   band with sample sizes shown and a note that small groups give wide intervals; plus limitations.
8. **Saved scenarios + contact**: a what-if run can be saved and shared via `/s/<id>`; contact
   form (name, email, message, consent) stored in Postgres, with a honeypot field and a simple
   per-IP rate limit.

Cut by the council: batch CSV upload (invites real PII), bring-your-own-schema, LLM narrative,
PDF brief, testimonials. The reference design's testimonial carousel becomes a **"Questions
leaders ask"** carousel answered with real numbers from the data.

## Data model (Postgres)

- `employees` — seeded from the CSV (synthetic `employee_id` 1001–2470), plus out-of-fold
  `risk_score`, `risk_band`, and top drivers (JSON).
- `model_runs` — artifact version, metrics JSON (before + after), threshold, created_at.
- `scenarios` — employee_id, lever changes JSON, before/after score, short public id, created_at.
- `contact_messages` — name, email, message, consent, created_at, ip_hash.

## API (FastAPI, `/api`)

`GET /employees` (filters, paging) · `GET /employees/{id}` (card + drivers) ·
`POST /simulate` (employee_id + lever overrides → score + drivers) · `POST /scenarios` ·
`GET /scenarios/{public_id}` · `GET /workforce/summary` (heatmap, distribution, segment compare) ·
`GET /model/metrics` (before/after, CIs, threshold curve, calibration, fairness) ·
`POST /contact` · `GET /health`.

## Look and motion

Reference image: `docs/design/reference.png` (the owner's inspiration shot; gitignored because
it is a third-party design, kept locally only). Follow its layout language without copying its text, brand or photos:
- **Hero**: full-bleed misty blue-grey atmosphere made with a canvas particle haze + gradients
  (no stock photos), slowly drifting and reacting gently to the pointer. A huge tight-tracked
  grotesk headline split across the hero, with letters rising in. Thin circular line accent
  that draws itself on load. Small top nav with arrow links. Pill CTA with a black circle arrow
  that rotates on hover. A numbered list on the right: `//01 —— Predict`, `//02 —— Simulate`,
  `//03 —— Explain`, `//04 —— Retain`, with lines that draw in.
- **About**: white section; large statement heading whose words fade from black to grey as you
  scroll; pill tags that stagger in.
- **Before/After**: pinned scroll section; numbers count and morph; bug cards slide in.
- **Live demo strip**: an embedded mini what-if slider on the landing page with a spring-animated
  risk bar.
- **Questions leaders ask**: carousel with drag/swipe and an animated stat.
- **Contact**: two-column, underline inputs, consent checkbox, animated submit state.
- **Footer**: dark slate, huge "Get in Touch"-style wordmark that reveals on scroll, social links
  with arrow nudges.
- App pages share tokens: off-white background, slate/blue-grey accents, one grotesk family,
  1px hairlines, rounded-xl cards; page transitions are quick crossfades; numbers tween.
- `prefers-reduced-motion`: replace movement with opacity changes; the particle haze becomes static.
- Responsive at 375px and 1440px. Lighthouse accessibility ≥ 95 on the landing page.
- Skills to apply during the build: impeccable / design-taste-frontend / emil-design-eng for
  design, animate + motion-react for motion, dataviz (+ bklit-charts) for charts, playwright
  for visual verification at both widths.

## Repo structure (target)

```
ml/            data.py, features.py, train.py, evaluate.py, explain.py
data/raw/      IBM CSV, demo CSV
notebooks/     cleaned notebook importing ml/, runs top-to-bottom
models/        gitignored, built by `python -m ml.train`
api/           FastAPI app, Alembic migrations, seed script, tests
web/           Next.js app
docs/          report .docx, MODEL_CARD.md, specs/
tests/         ML tests (incl. a leakage guard: no test-row index in the training set)
.github/workflows/ci.yml  ruff + pytest + web build
docker-compose.yml, .env.example, Makefile/scripts, README.md, LICENSE (MIT)
```

## Phases and checkpoints

- **A — GitHub-ready + honest model.** Ends with: `python -m ml.train` prints before/after
  metrics with CIs; pytest green; the notebook executes via nbconvert; commit on
  `chore/github-ready`. No UI work starts before `metrics.json` exists.
- **B — App.** API → simulator + explorer → landing page → workforce map + cost lens →
  transparency page → contact/scenarios → Docker. Ends with: migrations and seed run, all tests
  and `next build` pass, verified in a real browser at 375px and 1440px; commit on `feat/web-app`.
- **Scope of exposure** (builder's call): local only for now. Still build the contact form and
  share links to a deploy-ready standard: salted IP hash (salt from env), honeypot + rate limit,
  short privacy note under the form, and `python -m api.scripts.messages` to read submissions.
- **Existing root files** (builder's call, nothing deleted): `git mv` the original notebook to
  `notebooks/original.ipynb` unchanged (it is the source of the "before" numbers); the cleaned
  notebook becomes `notebooks/attrition.ipynb`; the report moves to `docs/`; both CSVs move to
  `data/raw/`. `employee_attrition_test_demo.csv` (renamed `demo_sample.csv`) turned out to be 20 copies of dataset rows, so it is only a format fixture; never present its refit scores as
  out-of-sample (`ml.score.in_training` detects this).
- No pushing to GitHub and no remote creation without the owner's go-ahead.

## Left to the builder

Exact fonts and palette (grotesk + slate/blue-grey), chart library choice per chart, copy
wording, the number and order of landing sections beyond those listed, the honeypot/rate-limit
implementation, and the hero canvas technique.
