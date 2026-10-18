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


def build_core() -> Pipeline:
    """Encoder -> SMOTE (applied to training data only, by construction) -> XGBoost."""
    return Pipeline([
        ("enc", build_encoder()),
        ("smote", SMOTE(random_state=RANDOM_STATE)),
        ("xgb", XGBClassifier(**BASELINE_PARAMS)),
    ])


def build_pipeline() -> CalibratedClassifierCV:
    """SMOTE skews probabilities upward; calibration maps them back to real rates.

    Sigmoid (Platt) rather than isotonic: on 1,470 rows isotonic steps pinned some people at
    exactly 100%, a certainty the model does not have. Held-out metrics are equivalent.
    """
    return CalibratedClassifierCV(build_core(), method="sigmoid", cv=3)
