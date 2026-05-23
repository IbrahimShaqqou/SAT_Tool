"""Rename practice_tests.metadata to test_metadata

Revision ID: 20260523_rename_metadata
Revises: 20260522_practice_tests
Create Date: 2026-05-23 06:50:00.000000

The original migration created a column named 'metadata', which is a reserved
name in SQLAlchemy's Declarative API. The model uses `test_metadata` to avoid
the conflict, so this migration renames the column to match.
"""
from alembic import op


revision = '20260523_rename_metadata'
down_revision = '20260522_practice_tests'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'practice_tests',
        'metadata',
        new_column_name='test_metadata',
    )


def downgrade():
    op.alter_column(
        'practice_tests',
        'test_metadata',
        new_column_name='metadata',
    )
