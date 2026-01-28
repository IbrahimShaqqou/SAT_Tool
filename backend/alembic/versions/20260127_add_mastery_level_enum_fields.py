"""Add mastery level enum and difficulty-specific tracking fields to student_skills

Revision ID: 20260127_mastery_levels
Revises: 20260120_add_time_expired_to_assignments
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260127_mastery_levels'
down_revision: Union[str, None] = '20260120_add_time_expired_to_assignments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add mastery_level_enum (0=NOT_STARTED, 1=FAMILIAR, 2=PROFICIENT, 3=MASTERED)
    op.add_column('student_skills', sa.Column(
        'mastery_level_enum',
        sa.Integer(),
        nullable=False,
        server_default='0',
        comment='Mastery level: 0=Not Started, 1=Familiar, 2=Proficient, 3=Mastered'
    ))

    # Add difficulty-specific tracking for hard questions (b >= 1.0)
    op.add_column('student_skills', sa.Column(
        'hard_questions_correct',
        sa.Integer(),
        nullable=False,
        server_default='0',
        comment='Correct answers on hard questions (b >= 1.0)'
    ))
    op.add_column('student_skills', sa.Column(
        'hard_questions_total',
        sa.Integer(),
        nullable=False,
        server_default='0',
        comment='Total hard questions attempted (b >= 1.0)'
    ))

    # Add difficulty-specific tracking for medium+ questions (b >= 0)
    op.add_column('student_skills', sa.Column(
        'medium_questions_correct',
        sa.Integer(),
        nullable=False,
        server_default='0',
        comment='Correct answers on medium+ questions (b >= 0)'
    ))
    op.add_column('student_skills', sa.Column(
        'medium_questions_total',
        sa.Integer(),
        nullable=False,
        server_default='0',
        comment='Total medium+ questions attempted (b >= 0)'
    ))

    # Backfill mastery_level_enum from existing data
    # For existing records with data, calculate initial mastery level
    op.execute("""
        UPDATE student_skills
        SET mastery_level_enum = CASE
            -- MASTERED: 8+ responses, theta >= 1, practiced recently (within 14 days)
            WHEN responses_for_estimate >= 8
                AND ability_theta >= 1.0
                AND last_practiced_at > NOW() - INTERVAL '14 days'
                AND (CASE WHEN questions_attempted > 0
                     THEN (questions_correct::float / questions_attempted) * 100
                     ELSE 0 END) >= 80
            THEN 3
            -- PROFICIENT: 5+ responses, theta >= 0
            WHEN responses_for_estimate >= 5
                AND ability_theta >= 0
                AND (CASE WHEN questions_attempted > 0
                     THEN (questions_correct::float / questions_attempted) * 100
                     ELSE 0 END) >= 70
            THEN 2
            -- FAMILIAR: 3+ responses, 50%+ accuracy
            WHEN responses_for_estimate >= 3
                AND (CASE WHEN questions_attempted > 0
                     THEN (questions_correct::float / questions_attempted) * 100
                     ELSE 0 END) >= 50
            THEN 1
            -- NOT_STARTED or doesn't meet criteria
            ELSE 0
        END
        WHERE responses_for_estimate > 0
    """)


def downgrade() -> None:
    op.drop_column('student_skills', 'medium_questions_total')
    op.drop_column('student_skills', 'medium_questions_correct')
    op.drop_column('student_skills', 'hard_questions_total')
    op.drop_column('student_skills', 'hard_questions_correct')
    op.drop_column('student_skills', 'mastery_level_enum')
