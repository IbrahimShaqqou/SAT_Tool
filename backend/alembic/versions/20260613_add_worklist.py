"""Add worklist_items + mastery_checks (score-raising loop)

Revision ID: 20260613_worklist
Revises: 20260607_study_plans
Create Date: 2026-06-13 00:00:00.000000

The live, ordered "what to work on between practice tests" worklist and the
mastery-check attempts that gate each skill. See
docs/superpowers/specs/2026-06-13-score-raising-loop-design.md.

NOTE: Railway's start command does not run migrations automatically — apply
this manually on deploy (`alembic upgrade head`).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260613_worklist'
down_revision = '20260607_study_plans'
branch_labels = None
depends_on = None


WORKLIST_STATUS = ('open', 'in_progress', 'passed', 'needs_tutor', 'done', 'refresh')
CHECK_KIND = ('baseline', 'mastery', 'refresh')
WORKLIST_SOURCE = ('auto', 'tutor')


def upgrade():
    worklist_status = postgresql.ENUM(*WORKLIST_STATUS, name='workliststatus')
    check_kind = postgresql.ENUM(*CHECK_KIND, name='masterycheckkind')
    worklist_source = postgresql.ENUM(*WORKLIST_SOURCE, name='worklistsource')
    bind = op.get_bind()
    worklist_status.create(bind, checkfirst=True)
    check_kind.create(bind, checkfirst=True)
    worklist_source.create(bind, checkfirst=True)

    op.create_table(
        'worklist_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, comment='Student who owns this item'),
        sa.Column('skill_id', sa.Integer(), nullable=False, comment='The skill being worked'),
        sa.Column('source_session_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Imported test that spawned this item (null = tutor-added)'),
        sa.Column('status', worklist_status, nullable=False, server_default='open', comment='Lifecycle status'),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0', comment='Order in the list'),
        sa.Column('baseline_accuracy', sa.Float(), nullable=True, comment="Skill % on the source test"),
        sa.Column('baseline_check_id', postgresql.UUID(as_uuid=True), nullable=True, comment="Authoritative 'before' MasteryCheck id (soft ref)"),
        sa.Column('current_accuracy', sa.Float(), nullable=True, comment="Latest measured %"),
        sa.Column('source', worklist_source, nullable=False, server_default='auto', comment='How the item got here'),
        sa.Column('tutor_locked', sa.Boolean(), nullable=False, server_default=sa.text('false'), comment="Tutor pinned; auto-gen won't remove"),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Cached lesson link for this skill, if any'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True, comment='When the item reached done'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['skill_id'], ['skills.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_session_id'], ['test_sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'skill_id', name='uq_worklist_student_skill'),
        comment='Live, ordered per-skill worklist',
    )
    op.create_index('ix_worklist_items_student_id', 'worklist_items', ['student_id'])
    op.create_index('ix_worklist_items_skill_id', 'worklist_items', ['skill_id'])
    op.create_index('ix_worklist_items_status', 'worklist_items', ['status'])
    op.create_index('ix_worklist_student_status', 'worklist_items', ['student_id', 'status'])

    op.create_table(
        'mastery_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('worklist_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', check_kind, nullable=False, server_default='mastery'),
        sa.Column('question_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('responses', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('score', sa.Integer(), nullable=True, comment='# correct (0-5)'),
        sa.Column('hard_correct', sa.Integer(), nullable=True, comment='# hard correct (0-2)'),
        sa.Column('passed', sa.Boolean(), nullable=True, comment='score>=4 AND hard_correct>=1'),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1', comment='Retry tracking (cap 2)'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['worklist_item_id'], ['worklist_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        comment='Mastery-check attempts (1E/2M/2H)',
    )
    op.create_index('ix_mastery_checks_worklist_item_id', 'mastery_checks', ['worklist_item_id'])
    op.create_index('ix_mastery_checks_student_id', 'mastery_checks', ['student_id'])


def downgrade():
    op.drop_table('mastery_checks')
    op.drop_index('ix_worklist_student_status', table_name='worklist_items')
    op.drop_table('worklist_items')
    bind = op.get_bind()
    for name in ('workliststatus', 'masterycheckkind', 'worklistsource'):
        postgresql.ENUM(name=name).drop(bind, checkfirst=True)
