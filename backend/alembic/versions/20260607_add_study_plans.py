"""Add study_plans table (import-driven study plans)

Revision ID: 20260607_study_plans
Revises: 20260523_official_practice_enum
Create Date: 2026-06-07 00:00:00.000000

One plan per imported practice-test attempt: focus skills to learn + practice,
the recommended next test, and per-skill movement vs. the previous import.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260607_study_plans'
down_revision = '20260523_official_practice_enum'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'study_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Study plan UUID'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Student who owns this plan'),
        sa.Column('test_session_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Imported attempt this plan was built from'),
        sa.Column('test_number', sa.Integer(), nullable=True, comment='Practice-test number this plan is for'),
        sa.Column('focus_skills', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Ordered weakest skills to focus on'),
        sa.Column('also_review', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Remaining weak skills worth reviewing'),
        sa.Column('recommended_next_test', sa.Integer(), nullable=True, comment='Next practice-test number to take'),
        sa.Column('next_test_reason', sa.Text(), nullable=True, comment='Explanation for the next-test recommendation'),
        sa.Column('deltas', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Per-skill + score movement vs. the previous import'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['test_session_id'], ['test_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('test_session_id'),
        comment='Import-driven study plans, one per practice-test attempt',
    )
    op.create_index(op.f('ix_study_plans_student_id'), 'study_plans', ['student_id'], unique=False)
    op.create_index(op.f('ix_study_plans_test_session_id'), 'study_plans', ['test_session_id'], unique=True)


def downgrade():
    op.drop_index(op.f('ix_study_plans_test_session_id'), table_name='study_plans')
    op.drop_index(op.f('ix_study_plans_student_id'), table_name='study_plans')
    op.drop_table('study_plans')
