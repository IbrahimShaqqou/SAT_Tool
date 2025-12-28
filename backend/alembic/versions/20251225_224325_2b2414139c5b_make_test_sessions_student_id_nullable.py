"""Make test_sessions student_id nullable

Revision ID: 2b2414139c5b
Revises: 7a1320a2e8f4
Create Date: 2025-12-25 22:43:25.282614
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b2414139c5b'
down_revision: Union[str, None] = '7a1320a2e8f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make student_id nullable for guest assessments."""
    op.alter_column('test_sessions', 'student_id',
                    existing_type=sa.UUID(),
                    nullable=True)


def downgrade() -> None:
    """Revert student_id to not nullable."""
    op.alter_column('test_sessions', 'student_id',
                    existing_type=sa.UUID(),
                    nullable=False)
