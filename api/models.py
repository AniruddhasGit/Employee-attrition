from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base

Json = JSON().with_variant(JSONB(), "postgresql")


class Employee(Base):
    __tablename__ = "employees"

    employee_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department: Mapped[str] = mapped_column(String(64), index=True)
    job_role: Mapped[str] = mapped_column(String(64), index=True)
    job_level: Mapped[int]
    years_at_company: Mapped[int]
    monthly_income: Mapped[int]
    overtime: Mapped[str] = mapped_column(String(3))
    features: Mapped[dict] = mapped_column(Json)
    risk_score: Mapped[float] = mapped_column(Float, index=True)
    risk_band: Mapped[str] = mapped_column(String(16), index=True)
    drivers: Mapped[list] = mapped_column(Json)
    attrition: Mapped[int]
    fold: Mapped[int]


class ModelRun(Base):
    __tablename__ = "model_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(32), unique=True)
    metrics: Mapped[dict] = mapped_column(Json)
    threshold: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.employee_id"))
    levers: Mapped[dict] = mapped_column(Json)
    before: Mapped[float]
    after: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254))
    message: Mapped[str] = mapped_column(Text)
    consent: Mapped[bool] = mapped_column(Boolean)
    ip_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
