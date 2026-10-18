from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


Band = Literal["low", "elevated", "high"]


class Driver(BaseModel):
    feature: str
    value: str | int | float
    impact: float
    direction: Literal["raises", "lowers"]
    text: str


class Levers(CamelModel):
    """The only inputs a visitor may change. Protected attributes are never levers."""

    over_time: Literal["Yes", "No"] | None = None
    monthly_income: int | None = Field(None, ge=1000, le=20000)
    stock_option_level: int | None = Field(None, ge=0, le=3)
    job_level: int | None = Field(None, ge=1, le=5)
    training_times_last_year: int | None = Field(None, ge=0, le=6)
    business_travel: Literal["Non-Travel", "Travel_Rarely", "Travel_Frequently"] | None = None
    years_since_last_promotion: int | None = Field(None, ge=0, le=15)

    def to_features(self) -> dict:
        """{feature column: value} for the levers that were set."""
        return {_column(k): v for k, v in self.model_dump(exclude_none=True).items()}

    @classmethod
    def from_features(cls, features: dict) -> "Levers":
        return cls(**{name: features[_column(name)] for name in cls.model_fields})


def _column(field_name: str) -> str:
    """over_time -> OverTime (the dataset's column name)."""
    camel = to_camel(field_name)
    return camel[0].upper() + camel[1:]


LEVER_FEATURES = [_column(k) for k in Levers.model_fields]


class EmployeeCard(CamelModel):
    id: int
    department: str
    job_role: str
    job_level: int
    years_at_company: int
    monthly_income: int
    over_time: str
    risk_score: float
    risk_band: Band
    drivers: list[Driver]


class EmployeeDetail(EmployeeCard):
    levers: Levers


class EmployeePage(CamelModel):
    items: list[EmployeeCard]
    total: int


class SimulateIn(CamelModel):
    employee_id: int
    levers: Levers = Levers()


class SimulateOut(CamelModel):
    before: float
    after: float
    delta: float
    before_band: Band
    after_band: Band
    drivers: list[Driver]
