"""Add invites table

Revision ID: 7a1320a2e8f4
Revises: 001_initial_schema
Create Date: 2025-12-25 13:53:28.392033
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7a1320a2e8f4'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Apply migration changes."""
    # Create invitestatus enum
    invitestatus = postgresql.ENUM('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', name='invitestatus', create_type=False)
    invitestatus.create(op.get_bind(), checkfirst=True)

    # Create invites table
    op.create_table('invites',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('tutor_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('subject_area', postgresql.ENUM('MATH', 'READING_WRITING', name='subjectarea', create_type=False), nullable=True),
        sa.Column('question_count', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('status', postgresql.ENUM('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', name='invitestatus', create_type=False), nullable=False, server_default='ACTIVE'),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('guest_name', sa.String(length=100), nullable=True),
        sa.Column('guest_email', sa.String(length=255), nullable=True),
        sa.Column('test_session_id', sa.UUID(), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['test_session_id'], ['test_sessions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tutor_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invites_created_at'), 'invites', ['created_at'], unique=False)
    op.create_index(op.f('ix_invites_token'), 'invites', ['token'], unique=True)


def downgrade() -> None:
    """Revert migration changes."""
    op.drop_index(op.f('ix_invites_token'), table_name='invites')
    op.drop_index(op.f('ix_invites_created_at'), table_name='invites')
    op.drop_table('invites')

    # Drop invitestatus enum
    invitestatus = postgresql.ENUM('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', name='invitestatus')
    invitestatus.drop(op.get_bind(), checkfirst=True)
