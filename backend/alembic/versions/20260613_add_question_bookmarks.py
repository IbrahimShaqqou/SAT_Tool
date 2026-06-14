"""Add question_bookmarks (Question Bank redesign)

Revision ID: 20260613_bookmarks
Revises: 20260613_worklist
Create Date: 2026-06-13 12:00:00.000000

A student's saved/starred Question Bank questions. See
docs/superpowers/specs/2026-06-13-question-bank-redesign-design.md.

NOTE: Railway's start command does not run migrations automatically — apply
this manually on deploy (`alembic upgrade head`).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260613_bookmarks'
down_revision = '20260613_worklist'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'question_bookmarks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['question_id'], ['questions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'question_id', name='uq_bookmark_student_question'),
        comment="A student's saved Question Bank questions",
    )
    op.create_index('ix_question_bookmarks_student_id', 'question_bookmarks', ['student_id'])
    op.create_index('ix_question_bookmarks_question_id', 'question_bookmarks', ['question_id'])
    op.create_index('ix_bookmark_student', 'question_bookmarks', ['student_id'])


def downgrade():
    op.drop_table('question_bookmarks')
