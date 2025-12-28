"""Make student_responses student_id nullable

Revision ID: 3c3515249d6c
Revises: 2b2414139c5b
Create Date: 2025-12-26
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c3515249d6c'
down_revision: Union[str, None] = '2b2414139c5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make student_id nullable for guest assessments."""
    op.alter_column('student_responses', 'student_id',
                    existing_type=sa.UUID(),
                    nullable=True)


def downgrade() -> None:
    """Revert student_id to not nullable."""
    op.alter_column('student_responses', 'student_id',
                    existing_type=sa.UUID(),
                    nullable=False)
