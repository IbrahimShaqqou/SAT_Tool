"""Add Leitner review fields to worklist_items (forgetting loop)

Revision ID: 20260614_review
Revises: 20260613_bookmarks
Create Date: 2026-06-14 00:00:00.000000

box + review_due_at power the spaced-repetition "forgetting loop": a mastered
skill resurfaces as a refresh check when its review interval elapses. See
docs/superpowers/specs/2026-06-13-study-plan-and-forgetting-notes.md.

NOTE: Railway's start command does not run migrations automatically — apply
this manually on deploy (`alembic upgrade head`).
"""
from alembic import op
import sqlalchemy as sa

revision = '20260614_review'
down_revision = '20260613_bookmarks'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('worklist_items', sa.Column(
        'box', sa.Integer(), nullable=False, server_default='0',
        comment='Leitner box (0=not in review; 1..N = review stage)',
    ))
    op.add_column('worklist_items', sa.Column(
        'review_due_at', sa.DateTime(timezone=True), nullable=True,
        comment='When a mastered skill should resurface as a refresh check',
    ))
    op.create_index('ix_worklist_review_due', 'worklist_items', ['student_id', 'review_due_at'])


def downgrade():
    op.drop_index('ix_worklist_review_due', table_name='worklist_items')
    op.drop_column('worklist_items', 'review_due_at')
    op.drop_column('worklist_items', 'box')
