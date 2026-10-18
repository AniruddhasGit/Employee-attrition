# Model card: Retain attrition model v1.0.0

## What it is

A gradient-boosted tree model (XGBoost) that estimates **P(leave)**: the probability that an
employee leaves, given 27 HR attributes. It powers the Retain demo app. It is a demonstration
of a method, not a product for real HR decisions.

## Data

- **IBM HR Analytics Employee Attrition & Performance**: 1,470 *fictional* employees created by
  IBM data scientists, 237 of whom (16.1%) left. Widely mirrored on Kaggle.
- Because the data is fictional, the numbers describe this dataset only. Using the method on a
  real organisation means retraining on that organisation's data.

## Inputs

27 columns: business travel, department, education and field, job role, overtime, pay rates,
income, job level, satisfaction and involvement scores, performance rating, stock options,
tenure and promotion history, training, work-life balance.

**Deliberately excluded:**
- `Gender`, `Age`, `MaritalStatus`: protected or immutable. They are used only to audit fairness.
- `EmployeeCount`, `EmployeeNumber`, `Over18`, `StandardHours`: constants or identifiers.

## Method

1. A stratified 80/20 split creates a test set of 294 employees (47 leavers) that is never
   used for training or tuning.
2. Pipeline: one-hot encoding → SMOTE (on training rows only) → XGBoost with tuned
   hyperparameters (see "Tuning" below).
3. The pipeline is wrapped in sigmoid (Platt) calibration (3-fold), because SMOTE inflates
   probabilities. Isotonic calibration was tried first, but it pinned some people at exactly 100%.
4. **Threshold = 0.227.** It is the cut-off that maximised F1 on 5-fold out-of-fold predictions
   within the training set.
5. Every risk score shown in the app is **out-of-fold**: 5-fold cross-validation over all 1,470
   employees, so each person is scored by a model that never saw them. The what-if simulator
   uses that same fold model. A model refit on all rows is kept only for scoring new rows.

## Results

| Metric | Before: original predictor, in-sample, 1,470 rows, cut-off 0.9 | After: held-out, 294 rows, cut-off 0.227 | 95% CI (after) |
|---|---|---|---|
| ROC-AUC | 0.962 | **0.814** | 0.731 – 0.890 |
| PR-AUC | 0.832 | **0.600** | 0.468 – 0.731 |
| Precision | 0.409 | **0.491** | 0.365 – 0.617 |
| Recall | 0.983 | **0.617** | 0.467 – 0.773 |
| F1 | 0.578 | **0.547** | 0.425 – 0.655 |
| Accuracy | 0.769 | **0.837** | 0.792 – 0.881 |
| Brier score | 0.459 | **0.096** | 0.070 – 0.120 |

On the test set the honest model flags 59 of 294 employees and catches 29 of the 47 who left.
The intervals are wide because only 47 test employees left.

### What was wrong with the original

The original notebook never printed any metrics. The "before" column re-runs its own
`predict_attrition_by_id` logic on every employee (`ml.evaluate.before_scores`), bugs included:

1. **Leakage.** It was trained and scored on the same rows, so its ranking (ROC-AUC 0.962) is
   inflated.
2. **No hold-out.** Its evaluation cell was commented out, and it had a bug: it built `xgb_live`
   but fitted `xgb_eval`.
3. **Broken single-row encoding.** `get_dummies(drop_first=True)` on one row drops every
   category's only dummy, so overtime, job role, department, travel and education field all
   reached the model as zero. Its probabilities were badly off (Brier 0.459), and at its 0.9
   cut-off it flagged 569 of 1,470 employees.
4. **Arbitrary threshold and labelling.** The hand-picked 0.9 cut-off was reported as
   "confidence", so an 89% chance of leaving was printed as "Likely to Stay".

Re-running it with today's library versions gives employee 1004 a score of 0.83; the notebook
printed 0.89. The gap comes from library and platform changes and does not change the conclusions.

### Platform variance

The numbers above come from the canonical Linux run (CI, Docker and hosting all use Linux).
Training on Windows with the same pinned versions gives slightly different floating-point results:
ROC-AUC 0.810 instead of 0.814, and a max-F1 threshold of 0.248 instead of 0.227. The ranking
metrics agree within noise. The threshold moving that much shows how flat the F1 curve is near
its peak, so treat the exact cut-off as a choice, not a discovery.

## Tuning

The XGBoost hyperparameters come from a 50-draw randomized search with 5-fold cross-validation
**inside the 80% training split only**. The test set was used once per finalist, never to tune.
Nine alternatives were compared on the same split: SMOTE vs `scale_pos_weight`, tuned logistic
regression, soft-voting ensembles, and six engineered ratio features.

| Held-out (Windows run, same split) | Before tuning | Tuned | Paired bootstrap difference, 95% CI |
|---|---|---|---|
| ROC-AUC | 0.795 | 0.810 | +0.015 (−0.001 to +0.031) |
| PR-AUC | 0.551 | 0.594 | +0.042 (+0.007 to +0.080) |
| Brier score | 0.103 | 0.096 | −0.007 (−0.013 to −0.001) |
| Calibration error (ECE) | 0.054 | 0.024 | |

The gain is modest: PR-AUC and Brier improve beyond chance on paired resampling, while ROC-AUC
and F1 stay within noise on 294 test rows. Choosing among ten candidates after seeing the test
set inflates the apparent gain a little. Logistic regression and ensembles did no better on the
test set and would lose the per-person SHAP explanations, and the engineered features helped
cross-validation but not the test set, so neither was adopted.

## Fairness check (out-of-fold scores, threshold 0.227)

| Group | n | Recall (leavers caught) |
|---|---|---|
| Female / Male | 588 / 882 | 0.72 / 0.61 |
| Age < 30 / 30–39 / 40–49 / 50+ | 326 / 622 / 349 / 173 | 0.80 / 0.62 / 0.53 / 0.35 |
| Single / Married / Divorced | 470 / 673 / 327 | 0.78 / 0.48 / 0.61 |

The model catches leavers unevenly. It finds younger and single employees who leave more often
than older or married ones, even though it never sees age or marital status. Other features act
as proxies (for example career length and job level). Anyone using this method for real would
have to investigate this before relying on it.

## Limitations

- Fictional data; the results do not transfer to any real company.
- SHAP drivers and what-if results describe how the *model* responds. They are associations,
  not causes.
- Not for decisions about individual people. Use it, at most, to look at patterns across groups.
- One random split. The test set is small, so the metrics are noisy (see the intervals above).

Reproduce: `make setup && make train`. Every metric above comes from `models/metrics.json`.
The dataset counts (1,470 employees, 237 leavers) come from the CSV, and the 0.89 comes from the original notebook's saved output.
