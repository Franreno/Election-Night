"""Add result_history table for upload rollback support

Revision ID: 004
Revises: 003
Create Date: 2026-02-16

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "004"
down_revision: str = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create result_history table
    op.create_table(
        "result_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "result_id",
            sa.Integer(),
            sa.ForeignKey("results.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "upload_id",
            sa.Integer(),
            sa.ForeignKey("upload_logs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("votes", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("votes >= 0", name="ck_history_votes_non_negative"),
    )
    op.create_index("ix_result_history_result_id", "result_history",
                    ["result_id"])
    op.create_index("ix_result_history_upload_id", "result_history",
                    ["upload_id"])

    # Backfill: create one history row per existing result that has an upload_id
    op.execute("""
        INSERT INTO result_history (result_id, upload_id, votes)
        SELECT id, upload_id, votes
        FROM results
        WHERE upload_id IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_index("ix_result_history_upload_id", table_name="result_history")
    op.drop_index("ix_result_history_result_id", table_name="result_history")
    op.drop_table("result_history")
