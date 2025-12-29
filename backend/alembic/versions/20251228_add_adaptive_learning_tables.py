"""Add adaptive learning tables

Revision ID: 20251228_adaptive
Revises: 20251226_124218_make_student_responses_student_id_nullable
Create Date: 2024-12-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251228_adaptive'
down_revision = '3c3515249d6c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create student_adaptive_settings table
    op.create_table(
        'student_adaptive_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Settings record UUID'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Student these settings apply to'),
        sa.Column('repetition_time_days', sa.Integer(), nullable=False, server_default='7', comment='Minimum days before question can repeat (default: 7)'),
        sa.Column('repetition_question_count', sa.Integer(), nullable=False, server_default='30', comment='Minimum other questions before repeat (default: 30)'),
        sa.Column('challenge_bias', sa.Float(), nullable=False, server_default='0.3', comment='Preference for harder questions (0.0-1.0, default: 0.3)'),
        sa.Column('theta_update_weight', sa.Float(), nullable=False, server_default='1.0', comment='Theta update aggressiveness (0.5-2.0, default: 1.0)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id'),
        comment='Tutor-configurable adaptive learning settings per student'
    )
    op.create_index('ix_student_adaptive_settings_student_id', 'student_adaptive_settings', ['student_id'])

    # Create student_domain_abilities table
    op.create_table(
        'student_domain_abilities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Record UUID'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Student ID'),
        sa.Column('domain_id', sa.Integer(), nullable=False, comment='Domain ID'),
        sa.Column('ability_theta', sa.Float(), nullable=False, server_default='0.0', comment='IRT ability estimate (theta). Range typically -3 to +3'),
        sa.Column('ability_se', sa.Float(), nullable=False, server_default='1.0', comment='Standard error of ability estimate'),
        sa.Column('responses_count', sa.Integer(), nullable=False, server_default='0', comment='Total responses in this domain'),
        sa.Column('last_updated', sa.DateTime(timezone=True), server_default=sa.text('now()'), comment='When ability was last updated'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['domain_id'], ['domains.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Student ability levels per domain'
    )
    op.create_index('ix_student_domain_abilities_student_id', 'student_domain_abilities', ['student_id'])
    op.create_index('ix_student_domain_abilities_domain_id', 'student_domain_abilities', ['domain_id'])
    op.create_index('uq_student_domain_ability', 'student_domain_abilities', ['student_id', 'domain_id'], unique=True)

    # Create student_section_abilities table
    op.create_table(
        'student_section_abilities',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Record UUID'),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Student ID'),
        sa.Column('section', sa.String(20), nullable=False, comment="Section: 'math' or 'reading_writing'"),
        sa.Column('ability_theta', sa.Float(), nullable=False, server_default='0.0', comment='IRT ability estimate (theta). Range typically -3 to +3'),
        sa.Column('ability_se', sa.Float(), nullable=False, server_default='1.0', comment='Standard error of ability estimate'),
        sa.Column('responses_count', sa.Integer(), nullable=False, server_default='0', comment='Total responses in this section'),
        sa.Column('predicted_score_low', sa.Integer(), nullable=True, comment='Lower bound of predicted section score (200-800)'),
        sa.Column('predicted_score_high', sa.Integer(), nullable=True, comment='Upper bound of predicted section score (200-800)'),
        sa.Column('last_updated', sa.DateTime(timezone=True), server_default=sa.text('now()'), comment='When ability was last updated'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Student ability levels per SAT section'
    )
    op.create_index('ix_student_section_abilities_student_id', 'student_section_abilities', ['student_id'])
    op.create_index('uq_student_section_ability', 'student_section_abilities', ['student_id', 'section'], unique=True)

    # Add index on student_responses for efficient repetition queries
    op.create_index(
        'ix_student_response_question_student_created',
        'student_responses',
        ['student_id', 'question_id', 'created_at'],
        postgresql_ops={'created_at': 'DESC'}
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_student_response_question_student_created', 'student_responses')

    # Drop tables
    op.drop_index('uq_student_section_ability', 'student_section_abilities')
    op.drop_index('ix_student_section_abilities_student_id', 'student_section_abilities')
    op.drop_table('student_section_abilities')

    op.drop_index('uq_student_domain_ability', 'student_domain_abilities')
    op.drop_index('ix_student_domain_abilities_domain_id', 'student_domain_abilities')
    op.drop_index('ix_student_domain_abilities_student_id', 'student_domain_abilities')
    op.drop_table('student_domain_abilities')

    op.drop_index('ix_student_adaptive_settings_student_id', 'student_adaptive_settings')
    op.drop_table('student_adaptive_settings')
