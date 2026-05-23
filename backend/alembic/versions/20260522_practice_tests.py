"""Add practice test tables

Revision ID: 20260522_practice_tests
Revises: 20260418_question_reports
Create Date: 2026-05-22 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260522_practice_tests'
down_revision = '20260418_question_reports'
branch_labels = None
depends_on = None


def upgrade():
    # Create practice_tests table
    op.create_table(
        'practice_tests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Practice test UUID'),
        sa.Column('test_number', sa.Integer(), nullable=False, comment='Test number (1-6)'),
        sa.Column('test_name', sa.String(length=100), nullable=False, comment="Display name (e.g., 'SAT Practice Test 4')"),
        sa.Column('description', sa.Text(), nullable=True, comment='Test description or context'),
        sa.Column('is_active', sa.Boolean(), nullable=False, comment='Whether test is available to students'),
        sa.Column('date_extracted', sa.DateTime(timezone=True), nullable=True, comment='When questions were mapped from Bluebook'),
        sa.Column('note', sa.Text(), nullable=True, comment='Implementation notes'),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Additional metadata (source, version, etc.)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('test_number'),
        comment='Official College Board Practice Test definitions'
    )
    op.create_index(op.f('ix_practice_tests_test_number'), 'practice_tests', ['test_number'], unique=True)

    # Create practice_test_modules table
    op.create_table(
        'practice_test_modules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, comment='Module UUID'),
        sa.Column('practice_test_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Parent practice test'),
        sa.Column('module_number', sa.Integer(), nullable=False, comment='Module number (1 or 2)'),
        sa.Column('module_type', sa.String(length=50), nullable=False, comment='module_1_standard, module_2_easier, or module_2_harder'),
        sa.Column('subject_area', sa.String(length=50), nullable=False, comment='math or reading_writing'),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=False, comment='Official time limit in minutes'),
        sa.Column('question_count', sa.Integer(), nullable=False, comment='Number of questions in this module'),
        sa.Column('question_uids', postgresql.JSONB(astext_type=sa.Text()), nullable=False, comment='Ordered array of question uIds'),
        sa.Column('difficulty_distribution', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='Percentage of easy/medium/hard questions'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['practice_test_id'], ['practice_tests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Modules within practice tests with question mappings'
    )
    op.create_index(op.f('ix_practice_test_modules_practice_test_id'), 'practice_test_modules', ['practice_test_id'], unique=False)
    op.create_index(
        'uq_practice_test_module',
        'practice_test_modules',
        ['practice_test_id', 'module_number', 'module_type', 'subject_area'],
        unique=True
    )


def downgrade():
    op.drop_index('uq_practice_test_module', table_name='practice_test_modules')
    op.drop_index(op.f('ix_practice_test_modules_practice_test_id'), table_name='practice_test_modules')
    op.drop_table('practice_test_modules')
    op.drop_index(op.f('ix_practice_tests_test_number'), table_name='practice_tests')
    op.drop_table('practice_tests')
