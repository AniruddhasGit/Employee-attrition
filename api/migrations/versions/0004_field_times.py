"""per-field record times; restorable seeded check-ins

Revision ID: 0004
Revises: 0003
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    op.add_column("employees", sa.Column("record_times", JSON, nullable=False,
                                         server_default=sa.text("'{}'")))
    op.drop_column("employees", "record_at")
    op.add_column("check_ins", sa.Column("seed_snapshot", JSON))


def downgrade() -> None:
    raise NotImplementedError("one-way migration")
