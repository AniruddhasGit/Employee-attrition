import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

CATEGORICAL = ["BusinessTravel", "Department", "EducationField", "JobRole", "OverTime"]
NUMERIC = [
    "DailyRate", "DistanceFromHome", "Education", "EnvironmentSatisfaction", "HourlyRate",
    "JobInvolvement", "JobLevel", "JobSatisfaction", "MonthlyIncome", "MonthlyRate",
    "NumCompaniesWorked", "PercentSalaryHike", "PerformanceRating", "RelationshipSatisfaction",
    "StockOptionLevel", "TotalWorkingYears", "TrainingTimesLastYear", "WorkLifeBalance",
    "YearsAtCompany", "YearsInCurrentRole", "YearsSinceLastPromotion", "YearsWithCurrManager",
]
FEATURES = CATEGORICAL + NUMERIC
ACTIONABLE = [
    "OverTime", "MonthlyIncome", "StockOptionLevel", "JobLevel",
    "TrainingTimesLastYear", "BusinessTravel", "YearsSinceLastPromotion",
]


def build_encoder() -> ColumnTransformer:
    """One-hot categoricals (unknown categories -> all zeros), pass numerics through."""
    return ColumnTransformer(
        [("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL)],
        remainder="passthrough",
        verbose_feature_names_out=False,
    )


def split_X_y(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    return df[FEATURES], df["Attrition"]
