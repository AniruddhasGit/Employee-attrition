"""HR-authored check-in questions, their answers, and stay intent

Revision ID: 0006
Revises: 0005
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "custom_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("label", sa.String(160), nullable=False),
        sa.Column("options", JSON, nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
        sa.Column("weights", JSON),
        sa.Column("created_quarter", sa.String(7), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index("ix_custom_questions_status", "custom_questions", ["status"])
    op.create_table(
        "custom_answers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(),
                  sa.ForeignKey("custom_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("employee_id", sa.Integer(),
                  sa.ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False),
        sa.Column("quarter", sa.String(7), nullable=False),
        sa.Column("option", sa.Integer(), nullable=False),
        sa.Column("simulated", sa.Boolean(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.UniqueConstraint("question_id", "employee_id", "quarter"),
    )
    op.create_index("ix_custom_answers_question_id", "custom_answers", ["question_id"])
    op.create_index("ix_custom_answers_employee_id", "custom_answers", ["employee_id"])
    op.create_table(
        "stay_intents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(),
                  sa.ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False),
        sa.Column("quarter", sa.String(7), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("simulated", sa.Boolean(), nullable=False),
        sa.Column("answered_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.UniqueConstraint("employee_id", "quarter"),
    )
    op.create_index("ix_stay_intents_employee_id", "stay_intents", ["employee_id"])


def downgrade() -> None:
    op.drop_table("stay_intents")
    op.drop_table("custom_answers")
    op.drop_table("custom_questions")
