"""Add lessons tables

Revision ID: 20260113_lessons
Revises: 20251228_intake
Create Date: 2026-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260113_lessons'
down_revision = '20251228_intake'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create lessons table
    op.create_table(
        'lessons',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Lesson UUID'),
        sa.Column('skill_id', sa.Integer(), nullable=True, comment='Associated skill ID (unique per lesson)'),
        sa.Column('domain_id', sa.Integer(), nullable=True, comment='Associated domain ID'),
        sa.Column('title', sa.String(200), nullable=False, comment='Lesson title'),
        sa.Column('subtitle', sa.String(500), nullable=True, comment='Lesson subtitle'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft', comment='Lesson status: draft, in_progress, published'),
        sa.Column('content_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}', comment='Rich lesson content as JSON'),
        sa.Column('estimated_minutes', sa.Integer(), nullable=False, server_default='10', comment='Estimated reading time in minutes'),
        sa.Column('difficulty_level', sa.String(20), nullable=False, server_default='intermediate', comment='Difficulty: beginner, intermediate, advanced'),
        sa.Column('icon', sa.String(50), nullable=True, comment='Icon name for display'),
        sa.Column('color', sa.String(20), nullable=True, comment='Accent color for lesson card'),
        sa.Column('cover_image_url', sa.String(500), nullable=True, comment='URL to cover image'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0', comment='Display order within domain'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', comment='Whether lesson is active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['domain_id'], ['domains.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('skill_id'),
        comment='Skill lessons with rich content'
    )
    op.create_index('ix_lessons_skill_id', 'lessons', ['skill_id'])
    op.create_index('ix_lessons_domain_id', 'lessons', ['domain_id'])
    op.create_index('ix_lessons_status', 'lessons', ['status'])
    op.create_index('ix_lessons_domain_status', 'lessons', ['domain_id', 'status'])
    op.create_index('ix_lessons_status_active', 'lessons', ['status', 'is_active'])

    # Create lesson_completions table
    op.create_table(
        'lesson_completions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False, comment='Completion record ID'),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), nullable=False, comment='The lesson that was completed'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Student who completed the lesson'),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=False, server_default='0', comment='Time spent on lesson in seconds'),
        sa.Column('progress_percent', sa.Integer(), nullable=False, server_default='100', comment='Progress percentage (0-100)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lesson_id', 'student_id', name='uq_lesson_student'),
        comment='Tracks student lesson completions'
    )
    op.create_index('ix_lesson_completions_student', 'lesson_completions', ['student_id'])
    op.create_index('ix_lesson_completions_lesson_id', 'lesson_completions', ['lesson_id'])


def downgrade() -> None:
    # Drop lesson_completions
    op.drop_index('ix_lesson_completions_lesson_id', 'lesson_completions')
    op.drop_index('ix_lesson_completions_student', 'lesson_completions')
    op.drop_table('lesson_completions')

    # Drop lessons
    op.drop_index('ix_lessons_status_active', 'lessons')
    op.drop_index('ix_lessons_domain_status', 'lessons')
    op.drop_index('ix_lessons_status', 'lessons')
    op.drop_index('ix_lessons_domain_id', 'lessons')
    op.drop_index('ix_lessons_skill_id', 'lessons')
    op.drop_table('lessons')
