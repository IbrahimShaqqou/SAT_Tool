"""Add time_expired column to assignments

Revision ID: add_time_expired_assignments
Revises: 198d997d157d
Create Date: 2026-01-20 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_time_expired_assignments'
down_revision: Union[str, None] = '198d997d157d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add time_expired column to assignments table
    op.add_column(
        'assignments',
        sa.Column(
            'time_expired',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='Whether assignment was auto-submitted due to timer expiration'
        )
    )


def downgrade() -> None:
    op.drop_column('assignments', 'time_expired')
