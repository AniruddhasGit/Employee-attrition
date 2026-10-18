from ml.data import PROTECTED, load_raw
from ml.features import ACTIONABLE, FEATURES, build_encoder, split_X_y


def test_features_exclude_protected():
    assert not set(PROTECTED) & set(FEATURES)
    assert len(FEATURES) == 27
    assert set(ACTIONABLE) <= set(FEATURES)


def test_split_selects_only_features():
    X, y = split_X_y(load_raw())
    assert list(X.columns) == FEATURES and len(y) == len(X) == 1470


def test_encoder_handles_unseen_category():
    X, _ = split_X_y(load_raw())
    enc = build_encoder().fit(X)
    row = X.iloc[[0]].copy()
    row["JobRole"] = "Astronaut"
    assert enc.transform(row).shape[1] == enc.transform(X.iloc[[0]]).shape[1]
