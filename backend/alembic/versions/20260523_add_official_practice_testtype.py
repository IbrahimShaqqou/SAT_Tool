"""Add OFFICIAL_PRACTICE to testtype enum

Revision ID: 20260523_official_practice_enum
Revises: 20260523_rename_metadata
Create Date: 2026-05-23 06:58:00.000000

The TestType Python enum gained an OFFICIAL_PRACTICE value when we added
practice tests, but the Postgres enum was never updated to match.
"""
from alembic import op


revision = '20260523_official_practice_enum'
down_revision = '20260523_rename_metadata'
branch_labels = None
depends_on = None


def upgrade():
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE testtype ADD VALUE IF NOT EXISTS 'OFFICIAL_PRACTICE'")


def downgrade():
    # PostgreSQL does not support removing enum values without recreating the type
    pass
