from ml.data import PROTECTED, load_raw


def test_load_raw_shape_and_ids():
    df = load_raw()
    assert len(df) == 1470
    assert df["EmployeeID"].iloc[0] == 1001 and df["EmployeeID"].iloc[-1] == 2470
    assert set(df["Attrition"].unique()) == {0, 1}
    assert not {"EmployeeCount", "EmployeeNumber", "Over18", "StandardHours"} & set(df.columns)


def test_load_raw_keeps_protected_for_fairness_audit():
    assert set(PROTECTED) <= set(load_raw().columns)
