from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.db import Base

Json = JSON().with_variant(JSONB(), "postgresql")


class Employee(Base):
    __tablename__ = "employees"

    employee_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), default="")
    is_current: Mapped[bool] = mapped_column(Boolean, index=True, default=True)
    # HR record overlay: model inputs changed by completed action plans (e.g. a pay review).
    record: Mapped[dict] = mapped_column(Json, default=dict)
    # When HR last changed the record; a newer change outranks an older check-in answer.
    record_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16))
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.employee_id"))
    display_name: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class CheckIn(Base):
    __tablename__ = "check_ins"
    __table_args__ = (UniqueConstraint("employee_id", "quarter"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.employee_id"), index=True)
    quarter: Mapped[str] = mapped_column(String(7), index=True)
    answers: Mapped[dict] = mapped_column(Json)  # keyed by model column name
    keep_me: Mapped[list] = mapped_column(Json)
    comment: Mapped[str] = mapped_column(Text, default="")
    risk_score: Mapped[float]
    drivers: Mapped[list | None] = mapped_column(Json, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    seeded: Mapped[bool] = mapped_column(Boolean, default=False, index=True)


class ActionPlan(Base):
    __tablename__ = "action_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.employee_id"), index=True)
    action: Mapped[str] = mapped_column(String(32))
    note: Mapped[str] = mapped_column(String(300), default="")
    created_quarter: Mapped[str] = mapped_column(String(7))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    score_at_creation: Mapped[float]
    estimated_score: Mapped[float]
    status: Mapped[str] = mapped_column(String(8), default="open")
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    seeded: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    seed_snapshot: Mapped[dict | None] = mapped_column(Json, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TeamUpdate(Base):
    __tablename__ = "team_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    department: Mapped[str] = mapped_column(String(64), index=True)
    quarter: Mapped[str] = mapped_column(String(7))
    said: Mapped[str] = mapped_column(String(280))
    did: Mapped[str] = mapped_column(String(280))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    seeded: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DemoState(Base):
    __tablename__ = "demo_state"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[dict] = mapped_column(Json)
