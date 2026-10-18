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
2. Pipeline: one-hot encoding → SMOTE (on training rows only) → XGBoost with the original
   notebook's hyperparameters.
3. The pipeline is wrapped in isotonic calibration (3-fold), because SMOTE inflates probabilities.
4. **Threshold = 0.282.** It is the cut-off that maximised F1 on 5-fold out-of-fold predictions
   within the training set.
5. Every risk score shown in the app is **out-of-fold**: 5-fold cross-validation over all 1,470
   employees, so each person is scored by a model that never saw them. The what-if simulator
   uses that same fold model. A model refit on all rows is kept only for scoring new rows.

## Results on the held-out test set

| Metric | Before (original notebook) | After (held-out) | 95% CI |
|---|---|---|---|
| ROC-AUC | 1.000 | **0.790** | 0.706 – 0.867 |
| PR-AUC | 1.000 | **0.547** | 0.409 – 0.692 |
| Precision | 1.000 | **0.488** | 0.333 – 0.633 |
| Recall | 0.439 | **0.447** | 0.302 – 0.595 |
| F1 | 0.610 | **0.467** | 0.328 – 0.593 |
| Accuracy | 0.909 | **0.837** | 0.792 – 0.881 |
| Brier score | 0.009 | **0.101** | 0.075 – 0.126 |

The intervals are wide because only 47 people in the test set left.

### Why the "before" numbers were wrong

1. **Leakage.** The original model was trained and scored on the same rows, so it was graded on
   answers it had memorised. That is why its ROC-AUC was 1.000.
2. **No hold-out.** Its evaluation cell was commented out, and it had a bug: it built `xgb_live`
   but fitted `xgb_eval`.
3. **Arbitrary threshold.** It used a hand-picked 0.9 cut-off and printed P(leave) as
   "confidence". As a result, 89% likely to leave was reported as "Likely to Stay".

## Fairness check (out-of-fold scores, threshold 0.282)

| Group | n | Recall (leavers caught) |
|---|---|---|
| Female / Male | 588 / 882 | 0.62 / 0.45 |
| Age < 30 / 30–39 / 40–49 / 50+ | 326 / 622 / 349 / 173 | 0.63 / 0.51 / 0.38 / 0.30 |
| Single / Married / Divorced | 470 / 673 / 327 | 0.62 / 0.37 / 0.52 |

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

Reproduce: `make setup && make train`. Every number above comes from `models/metrics.json`.
