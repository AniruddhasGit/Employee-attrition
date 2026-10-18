# Phase A — GitHub-ready repo + honest model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single leaky notebook into a reproducible, tested `ml/` package that produces honest held-out metrics (with CIs), the original notebook's "before" metrics, out-of-fold scores for every employee, and saved artifacts the Phase B API will load.

**Architecture:** Pure-Python package `ml/` (load → encode → train/evaluate → explain) driven by `python -m ml.train`, writing everything to `models/` (gitignored). The original notebook is preserved untouched; a new notebook imports `ml/`. CI runs ruff + pytest.

**Tech Stack:** Python 3.12, uv (venv + pinned requirements), pandas, scikit-learn, imbalanced-learn, xgboost, shap, joblib, pytest, ruff, nbconvert/ipykernel.

**Spec:** `docs/superpowers/specs/2026-10-18-retain-design.md` (Phase B gets its own plan after Checkpoint A).

## Global Constraints

- All paths resolved from the repo root via `pathlib`; no absolute paths anywhere.
- Main CSV has a UTF-8 BOM: read with `encoding="utf-8-sig"`.
- Model features EXCLUDE: `Gender`, `Age`, `MaritalStatus` (protected — fairness audit only) and `EmployeeCount`, `EmployeeNumber`, `Over18`, `StandardHours` (constant/ID).
- `EmployeeID` = 1001 + row index (matches the original notebook).
- Seed `RANDOM_STATE = 42` everywhere. Test split 80/20 stratified. CV = 5-fold stratified.
- Baseline XGBoost params (verbatim): `eval_metric='logloss', max_depth=4, learning_rate=0.03, n_estimators=1000, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.5, reg_lambda=1, random_state=42`.
- SMOTE only inside an `imblearn.pipeline.Pipeline`; calibration via `CalibratedClassifierCV(method="isotonic", cv=3)` wrapping that pipeline.
- Threshold = argmax F1 over out-of-fold calibrated probabilities on the training set.
- Copy rule: never the word "confidence" for a probability; use "risk score" / "P(leave)".
- `models/`, `.venv/`, `docs/design/reference.png` stay gitignored. No pushing, no remote.
- Free-hosting budget: all of `models/` must total < 50 MB and loading every artifact must use < 300 MB RAM (checked in Task 4).
- Stop and ask before deleting any file (moves via `git mv` are fine).

## Review Focus

- Leakage regressions: a test row's index appearing in any training fold → test `test_no_test_rows_in_training` (Task 3).
- Unseen category at score time (e.g. a JobRole not in training) → encoder must emit all-zero dummies, not crash → `test_encoder_handles_unseen_category` (Task 2).
- Demo CSV rows (no `Attrition` column, includes protected columns) scored by the refit model → valid probabilities in [0,1] → `test_score_demo_csv` (Task 4).
- Before-metrics reproducibility: rerunning train gives identical "before" numbers → `test_before_metrics_deterministic` (Task 3).
- Tiny subgroups in fairness slice (n < 30) → reported with `n` and flagged `small_sample: true`, not dropped → `test_fairness_flags_small_groups` (Task 4).

---

### Task 1: Repo restructure + tooling

**Files:**
- Move (git mv): `Project Final.ipynb` → `notebooks/original.ipynb`; `WA_Fn-UseC_-HR-Employee-Attrition.csv` → `data/raw/ibm_hr_attrition.csv`; `employee_attrition_test_demo.csv` → `data/raw/demo_unseen.csv`; `Employee_attrition_report.docx` → `docs/Employee_attrition_report.docx`
- Create: `pyproject.toml` (ruff + pytest config only, project name `retain`), `requirements.txt` (pinned via `uv pip compile`), `requirements-dev.txt`, `LICENSE` (MIT, "Copyright (c) 2026 Aniruddha Jathar"), `.env.example` (empty for now, header comment), `Makefile` (targets: `setup`, `train`, `test`, `lint`, `notebook`), `ml/__init__.py`, `ml/paths.py`
- Modify: `.gitignore` (add `models/`, `.pytest_cache/`, `.ruff_cache/`, `*.joblib`)

**Interfaces:**
- Produces: `ml.paths.ROOT`, `RAW_CSV`, `DEMO_CSV`, `MODELS_DIR` (all `pathlib.Path`).

- [ ] Step 1: `git mv` the four files; `uv venv .venv`; write requirements with unpinned names, `uv pip compile` → pinned `requirements.txt`; `uv pip install -r requirements.txt -r requirements-dev.txt`.
- [ ] Step 2: Verify: `.venv/Scripts/python -c "import xgboost, shap, imblearn, sklearn; print('ok')"` → `ok`; `ruff check .` → no errors.
- [ ] Step 3: Commit `chore: restructure repo, add tooling and license`.

### Task 2: Data loading + feature encoder

**Files:**
- Create: `ml/data.py`, `ml/features.py`, `tests/test_data.py`, `tests/test_features.py`

**Interfaces:**
- Produces:
  - `ml.data.load_raw(path: Path = RAW_CSV) -> pd.DataFrame` — adds `EmployeeID`, maps `Attrition` Yes/No→1/0, drops constant/ID columns; keeps protected columns.
  - `ml.data.PROTECTED = ["Gender", "Age", "MaritalStatus"]`
  - `ml.features.FEATURES: list[str]` (27 columns), `CATEGORICAL: list[str]`, `ACTIONABLE: list[str] = ["OverTime","MonthlyIncome","StockOptionLevel","JobLevel","TrainingTimesLastYear","BusinessTravel","YearsSinceLastPromotion"]`
  - `ml.features.build_encoder() -> sklearn ColumnTransformer` (OneHotEncoder(handle_unknown="ignore", drop=None) on CATEGORICAL, passthrough numeric) with `get_feature_names_out()`.
  - `ml.features.split_X_y(df) -> tuple[pd.DataFrame, pd.Series]` selecting FEATURES only.

- [ ] Step 1: Tests:
```python
def test_load_raw_shape_and_ids():
    df = load_raw()
    assert len(df) == 1470 and df["EmployeeID"].iloc[0] == 1001 and df["EmployeeID"].iloc[-1] == 2470
    assert set(df["Attrition"].unique()) == {0, 1}
    assert not {"EmployeeCount","EmployeeNumber","Over18","StandardHours"} & set(df.columns)

def test_features_exclude_protected():
    assert not set(PROTECTED) & set(FEATURES) and len(FEATURES) == 27

def test_encoder_handles_unseen_category():
    X, _ = split_X_y(load_raw()); enc = build_encoder().fit(X)
    row = X.iloc[[0]].copy(); row["JobRole"] = "Astronaut"
    assert enc.transform(row).shape[1] == enc.transform(X.iloc[[0]]).shape[1]
```
- [ ] Step 2: Run `pytest tests/test_data.py tests/test_features.py -v` → FAIL (import errors).
- [ ] Step 3: Implement the interfaces above.
- [ ] Step 4: Run the same command → PASS.
- [ ] Step 5: Commit `feat(ml): data loading and feature encoder`.

### Task 3: Training, before/after evaluation, out-of-fold scores

**Files:**
- Create: `ml/model.py`, `ml/evaluate.py`, `ml/train.py`, `tests/test_train.py`

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `ml.model.build_pipeline() -> CalibratedClassifierCV` wrapping `Pipeline([("enc", build_encoder()), ("smote", SMOTE(random_state=42)), ("xgb", XGBClassifier(**BASELINE_PARAMS))])`.
  - `ml.evaluate.metrics_at(y_true, proba, threshold) -> dict` keys: `roc_auc, pr_auc, precision, recall, f1, accuracy, confusion` (2×2 list), `brier`.
  - `ml.evaluate.bootstrap_ci(y_true, proba, threshold, n=1000, seed=42) -> dict[str, tuple[float,float]]` (95% percentile CI per scalar metric).
  - `ml.evaluate.before_metrics(df) -> dict` — replicates the original notebook: `pd.get_dummies(drop_first=True)` on ALL original features (incl. protected), SMOTE on all rows, baseline XGB fit on all, score same rows at threshold 0.9 → `metrics_at`.
  - `ml.evaluate.threshold_curve(y_true, proba) -> list[dict]` (threshold 0.05..0.95 step 0.05 → precision, recall, f1).
  - `ml.evaluate.calibration(y_true, proba, bins=10) -> list[dict]` (mean_pred, frac_pos, n).
  - `ml.train.main()` writes to `models/`: `fold_{0..4}.joblib`, `refit.joblib`, `oof.parquet` (EmployeeID, fold, risk_score), `metrics.json` (`before`, `after` = test-set metrics + `ci`, `threshold`, `threshold_curve`, `calibration`, `n_test_pos`, `created_at`, `version`), `test_ids.json`.
  - Procedure: split 80/20 → on train: 5-fold OOF calibrated probs → pick threshold → fit on full train → evaluate on test (`after`). Then 5-fold OOF over ALL 1,470 rows (save fold models + fold assignment; these are the site's scores) and a refit on all rows.

- [ ] Step 1: Tests (use a module-scoped fixture that runs `main()` once into `tmp_path_factory` via a `out_dir` param):
```python
def test_no_test_rows_in_training(artifacts):  # test_ids disjoint from the after-model's training ids
    assert not set(artifacts["test_ids"]) & set(artifacts["train_ids"])
def test_metrics_shape(artifacts):
    m = artifacts["metrics"]; assert 0.5 < m["after"]["roc_auc"] <= 1 and 0 < m["threshold"] < 1
    assert m["before"]["accuracy"] > m["after"]["accuracy"]   # leakage inflates
    assert all(lo <= m["after"][k] <= hi for k, (lo, hi) in m["after"]["ci"].items())
def test_oof_covers_everyone(artifacts):
    oof = artifacts["oof"]; assert len(oof) == 1470 and oof["risk_score"].between(0, 1).all() and set(oof["fold"]) == set(range(5))
def test_before_metrics_deterministic():
    df = load_raw(); assert before_metrics(df) == before_metrics(df)
```
- [ ] Step 2: Run `pytest tests/test_train.py -v` → FAIL.
- [ ] Step 3: Implement; `main(out_dir: Path = MODELS_DIR, n_boot: int = 1000)` (tests pass `n_boot=50`). Also save `train_ids.json`.
- [ ] Step 4: Run tests → PASS; then `python -m ml.train` and paste the printed before/after table (ROC-AUC, PR-AUC, precision, recall, F1 with CIs, threshold).
- [ ] Step 5: Commit `feat(ml): honest training with held-out eval, calibration, OOF scores`.

### Task 4: Explanations, fairness, scoring unseen rows

**Files:**
- Create: `ml/explain.py`, `ml/fairness.py`, `ml/score.py`, `tests/test_explain.py`

**Interfaces:**
- Consumes: Task 3 artifacts.
- Produces:
  - `ml.explain.top_drivers(model, row: pd.DataFrame, k=5) -> list[dict]` keys `feature` (original column name, one-hot groups summed back), `value`, `impact` (signed SHAP on the XGB step, log-odds), `direction` ("raises"|"lowers"), `text` (plain English, e.g. "Works overtime" / "No stock options"). SHAP TreeExplainer built once per model and cached.
  - `ml.explain.PLAIN: dict[str, Callable[[value], str]]` for all 27 features.
  - `ml.fairness.slices(df, oof, threshold) -> list[dict]` groups: Gender, age band (`<30`, `30–39`, `40–49`, `50+`), MaritalStatus → `group, value, n, attrition_rate, mean_risk, precision, recall, small_sample (n<30)`; appended to `metrics.json` under `fairness` by `train.main`.
  - `ml.score.score_frame(df: pd.DataFrame, model_path=MODELS_DIR/"refit.joblib") -> pd.Series` (accepts rows without `Attrition`, ignores extra columns).
  - `ml.train.main` additionally writes `drivers.parquet` (EmployeeID, drivers JSON) using each employee's fold model.

- [ ] Step 1: Tests:
```python
def test_top_drivers_plain_english(artifacts):
    d = top_drivers(fold_model_for(1001), row_for(1001))
    assert len(d) == 5 and all(x["text"] and x["direction"] in {"raises","lowers"} for x in d)
    assert not {x["feature"] for x in d} & {"Gender","Age","MaritalStatus"}
def test_fairness_flags_small_groups(artifacts):
    s = artifacts["metrics"]["fairness"]; assert any(g["small_sample"] for g in s) or all(g["n"] >= 30 for g in s)
    assert {g["group"] for g in s} == {"Gender","AgeBand","MaritalStatus"}
def test_score_demo_csv(artifacts):
    p = score_frame(pd.read_csv(DEMO_CSV), artifacts["dir"]/"refit.joblib"); assert len(p) == 20 and p.between(0,1).all()
```
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run full `pytest -v` → PASS.
- [ ] Step 5: Commit `feat(ml): SHAP plain-English drivers, fairness slices, unseen-row scoring`.

### Task 5: Clean notebook, model card, README, CI

**Files:**
- Create: `notebooks/attrition.ipynb` (imports `ml`, loads `models/metrics.json`, shows before/after table, threshold curve, calibration plot, one employee's drivers; no `input()`), `docs/MODEL_CARD.md`, `README.md`, `.github/workflows/ci.yml`

**Interfaces:** Consumes Tasks 1–4.

- [ ] Step 1: Build the notebook; verify `jupyter nbconvert --to notebook --execute notebooks/attrition.ipynb --output-dir /tmp-scratch` exits 0 (run `python -m ml.train` first).
- [ ] Step 2: MODEL_CARD.md: data (fictional IBM, attribution), excluded features and why, method (split, SMOTE-in-pipeline, calibration, threshold rule, OOF scores, refit), metrics with CIs copied from `metrics.json`, before/after with the three original bugs, fairness table, limitations ("demonstrates a method; retrain on a real organisation's data; associations not causes; not for decisions about individuals").
- [ ] Step 3: README.md: one-line pitch, screenshot placeholder, quickstart (`make setup && make train && make test`), mermaid architecture, metrics table (from `metrics.json`), repo layout, dataset attribution, license. CI: ubuntu, Python 3.12, `pip install -r requirements.txt -r requirements-dev.txt`, `ruff check .`, `pytest -q`.
- [ ] Step 4: Verify `ruff check .` and `pytest -q` pass; `git status` shows no `models/` or `.venv` files.
- [ ] Step 5: Commit `docs: clean notebook, model card, README, CI`.

**Checkpoint A:** report train output table, pytest summary, nbconvert exit status; stop for review before Phase B planning.
