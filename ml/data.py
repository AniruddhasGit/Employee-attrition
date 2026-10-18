from pathlib import Path

import pandas as pd

from ml.paths import RAW_CSV

PROTECTED = ["Gender", "Age", "MaritalStatus"]
CONSTANT_OR_ID = ["EmployeeCount", "EmployeeNumber", "Over18", "StandardHours"]
FIRST_ID = 1001


def load_raw(path: Path = RAW_CSV) -> pd.DataFrame:
    """Load the IBM HR CSV, add EmployeeID, encode Attrition as 1/0, drop constant/ID columns.

    Protected columns are kept: they are excluded from the model but needed for the fairness audit.
    """
    df = pd.read_csv(path, encoding="utf-8-sig")
    df.insert(0, "EmployeeID", range(FIRST_ID, FIRST_ID + len(df)))
    if "Attrition" in df:
        df["Attrition"] = df["Attrition"].map({"Yes": 1, "No": 0})
    return df.drop(columns=[c for c in CONSTANT_OR_ID if c in df.columns])
