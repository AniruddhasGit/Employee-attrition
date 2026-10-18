from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier

from ml.features import build_encoder

RANDOM_STATE = 42

# Hyperparameters from the original notebook, kept as the baseline.
BASELINE_PARAMS = dict(
    eval_metric="logloss",
    max_depth=4,
    learning_rate=0.03,
    n_estimators=1000,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.5,
    reg_lambda=1,
    random_state=RANDOM_STATE,
    n_jobs=1,
)

# Chosen by 50-draw randomized search, 5-fold CV inside the 80% training split only
# (see "Tuning" in docs/MODEL_CARD.md). BASELINE_PARAMS stays: evaluate.before_scores
# re-runs the original notebook with it.
TUNED_PARAMS = dict(
    BASELINE_PARAMS,
    max_depth=5,
    learning_rate=0.031448108040457876,
    n_estimators=500,
    subsample=0.7801997007878172,
    colsample_bytree=0.36342450417297456,
    min_child_weight=1,
    gamma=0.5,
    reg_alpha=2.752717392942941,
    reg_lambda=2.3201272353300353,
)


def build_core() -> Pipeline:
    """Encoder -> SMOTE (applied to training data only, by construction) -> XGBoost."""
    return Pipeline([
        ("enc", build_encoder()),
        ("smote", SMOTE(random_state=RANDOM_STATE)),
        ("xgb", XGBClassifier(**TUNED_PARAMS)),
    ])


def build_pipeline() -> CalibratedClassifierCV:
    """SMOTE skews probabilities upward; calibration maps them back to real rates.

    Sigmoid (Platt) rather than isotonic: on 1,470 rows isotonic steps pinned some people at
    exactly 100%, a certainty the model does not have. Held-out metrics are equivalent.
    """
    return CalibratedClassifierCV(build_core(), method="sigmoid", cv=3)
