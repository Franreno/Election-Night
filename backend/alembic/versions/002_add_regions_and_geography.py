"""Add regions table and geography columns to constituencies

Revision ID: 002
Revises: 001
Create Date: 2026-02-13

"""
import json
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa

from alembic import op

revision: str = "002"
down_revision: str = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONFIG_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "static"
    / "itl1_constituencies_config.json"
)


def upgrade() -> None:
    # 1. Create regions table
    op.create_table(
        "regions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at",
                  sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    # 2. Add geography columns to constituencies
    op.add_column(
        "constituencies",
        sa.Column("pcon24_code", sa.String(20), nullable=True),
    )
    op.add_column(
        "constituencies",
        sa.Column("region_id",
                  sa.Integer(),
                  sa.ForeignKey("regions.id"),
                  nullable=True),
    )
    op.create_index("ix_constituencies_pcon24_code",
                    "constituencies", ["pcon24_code"],
                    unique=True)
    op.create_index("ix_constituencies_region_id",
                    "constituencies", ["region_id"])

    # 3. Seed regions and populate constituency geography from config JSON
    if CONFIG_PATH.exists():
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        region_order = config.get("region_order", [])
        regions = config.get("regions", {})

        conn = op.get_bind()

        # Insert regions
        regions_table = sa.table(
            "regions",
            sa.column("id", sa.Integer),
            sa.column("name", sa.String),
            sa.column("sort_order", sa.Integer),
        )
        for i, region_name in enumerate(region_order):
            conn.execute(
                regions_table.insert().values(
                    id=i + 1,
                    name=region_name,
                    sort_order=i,
                ))

        # Update constituencies with pcon24_code and region_id
        constituencies_table = sa.table(
            "constituencies",
            sa.column("name", sa.String),
            sa.column("pcon24_code", sa.String),
            sa.column("region_id", sa.Integer),
        )
        for i, region_name in enumerate(region_order):
            region_id = i + 1
            for constituency in regions.get(region_name, []):
                conn.execute(
                    constituencies_table.update()
                    .where(constituencies_table.c.name
                           == constituency["name"])
                    .values(
                        pcon24_code=constituency["pcon24_code"],
                        region_id=region_id,
                    ))


def downgrade() -> None:
    op.drop_index("ix_constituencies_region_id", table_name="constituencies")
    op.drop_index("ix_constituencies_pcon24_code", table_name="constituencies")
    op.drop_column("constituencies", "region_id")
    op.drop_column("constituencies", "pcon24_code")
    op.drop_table("regions")
