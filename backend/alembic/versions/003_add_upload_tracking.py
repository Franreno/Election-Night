"""Add upload tracking: deleted_at on upload_logs, upload_id on results

Revision ID: 003
Revises: 002
Create Date: 2026-02-14

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "003"
down_revision: str = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add soft-delete marker to upload_logs
    op.add_column(
        "upload_logs",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_upload_logs_deleted_at", "upload_logs", ["deleted_at"])

    # Track which upload last wrote each result
    op.add_column(
        "results",
        sa.Column(
            "upload_id",
            sa.Integer(),
            sa.ForeignKey("upload_logs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_results_upload_id", "results", ["upload_id"])


def downgrade() -> None:
    op.drop_index("ix_results_upload_id", table_name="results")
    op.drop_column("results", "upload_id")
    op.drop_index("ix_upload_logs_deleted_at", table_name="upload_logs")
    op.drop_column("upload_logs", "deleted_at")
