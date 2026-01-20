"""make total_questions nullable for infinite sessions

Revision ID: 198d997d157d
Revises: 20260113_lessons
Create Date: 2026-01-20 03:56:07.496169
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '198d997d157d'
down_revision: Union[str, None] = '20260113_lessons'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make total_questions nullable for unlimited adaptive sessions."""
    op.alter_column('test_sessions', 'total_questions',
               existing_type=sa.INTEGER(),
               nullable=True,
               comment='Total number of questions in test (null for unlimited)')


def downgrade() -> None:
    """Revert total_questions to non-nullable."""
    # First update any NULL values to a default
    op.execute("UPDATE test_sessions SET total_questions = questions_answered WHERE total_questions IS NULL")
    op.alter_column('test_sessions', 'total_questions',
               existing_type=sa.INTEGER(),
               nullable=False,
               comment='Total number of questions in test')
