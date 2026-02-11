"""Initial schema - constituencies, results, upload_logs

Revision ID: 001
Revises:
Create Date: 2026-02-11

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "constituencies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at",
                  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("updated_at",
                  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    op.create_index("ix_constituencies_name",
                    "constituencies", ["name"],
                    unique=True)

    op.create_table(
        "results",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "constituency_id",
            sa.Integer(),
            sa.ForeignKey("constituencies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("party_code", sa.String(10), nullable=False),
        sa.Column("votes", sa.Integer(), nullable=False),
        sa.Column("created_at",
                  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("updated_at",
                  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.UniqueConstraint("constituency_id",
                            "party_code",
                            name="uq_constituency_party"),
        sa.CheckConstraint("votes >= 0", name="ck_votes_non_negative"),
    )
    op.create_index("ix_results_constituency_id", "results",
                    ["constituency_id"])
    op.create_index("ix_results_party_code", "results", ["party_code"])

    op.create_table(
        "upload_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("filename", sa.String(512)),
        sa.Column("status",
                  sa.String(20),
                  nullable=False,
                  server_default="processing"),
        sa.Column("total_lines", sa.Integer()),
        sa.Column("processed_lines", sa.Integer(), server_default="0"),
        sa.Column("error_lines", sa.Integer(), server_default="0"),
        sa.Column("errors", sa.JSON(), server_default="[]"),
        sa.Column("started_at",
                  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("upload_logs")
    op.drop_table("results")
    op.drop_table("constituencies")
