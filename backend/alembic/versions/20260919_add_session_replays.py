"""Add session_replays table for FL landing page recordings

Revision ID: 20260919_replays
Revises: 20260614_review
Create Date: 2026-09-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = '20260919_replays'
down_revision = '20260614_review'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'session_replays',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('page_url', sa.String(), nullable=False),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('events', JSONB(), nullable=False, server_default='[]'),
        sa.Column('duration_ms', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_session_replays_session_id', 'session_replays', ['session_id'], unique=True)
    op.create_index('ix_session_replays_created_at', 'session_replays', ['created_at'])


def downgrade():
    op.drop_index('ix_session_replays_created_at', table_name='session_replays')
    op.drop_index('ix_session_replays_session_id', table_name='session_replays')
    op.drop_table('session_replays')
