"""accounts, check-ins, action plans, team updates

Revision ID: 0002
Revises: 0001
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
NOW = sa.text("now()")


def upgrade() -> None:
    op.add_column("employees", sa.Column("name", sa.String(80), nullable=False, server_default=""))
    op.add_column("employees", sa.Column("is_current", sa.Boolean(), nullable=False,
                                         server_default=sa.true()))
    op.add_column("employees", sa.Column("record", JSON, nullable=False,
                                         server_default=sa.text("'{}'")))
    op.execute("UPDATE employees SET is_current = (attrition = 0)")
    op.create_index("ix_employees_is_current", "employees", ["is_current"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.employee_id")),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"])
    op.create_table(
        "check_ins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.employee_id"),
                  nullable=False),
        sa.Column("quarter", sa.String(7), nullable=False),
        sa.Column("answers", JSON, nullable=False),
        sa.Column("keep_me", JSON, nullable=False),
        sa.Column("comment", sa.Text(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("drivers", JSON),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("seeded", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("employee_id", "quarter"),
    )
    op.create_index("ix_check_ins_employee_id", "check_ins", ["employee_id"])
    op.create_index("ix_check_ins_quarter", "check_ins", ["quarter"])
    op.create_index("ix_check_ins_seeded", "check_ins", ["seeded"])
    op.create_table(
        "action_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.employee_id"),
                  nullable=False),
        sa.Column("action", sa.String(32), nullable=False),
        sa.Column("note", sa.String(300), nullable=False),
        sa.Column("created_quarter", sa.String(7), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("score_at_creation", sa.Float(), nullable=False),
        sa.Column("estimated_score", sa.Float(), nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
        sa.Column("done_at", sa.DateTime(timezone=True)),
        sa.Column("seeded", sa.Boolean(), nullable=False),
        sa.Column("seed_snapshot", JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index("ix_action_plans_employee_id", "action_plans", ["employee_id"])
    op.create_index("ix_action_plans_seeded", "action_plans", ["seeded"])
    op.create_table(
        "team_updates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("department", sa.String(64), nullable=False),
        sa.Column("quarter", sa.String(7), nullable=False),
        sa.Column("said", sa.String(280), nullable=False),
        sa.Column("did", sa.String(280), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("seeded", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index("ix_team_updates_department", "team_updates", ["department"])
    op.create_index("ix_team_updates_seeded", "team_updates", ["seeded"])
    op.create_table(
        "demo_state",
        sa.Column("key", sa.String(32), primary_key=True),
        sa.Column("value", JSON, nullable=False),
    )
    op.drop_table("scenarios")


def downgrade() -> None:
    raise NotImplementedError("one-way migration")
