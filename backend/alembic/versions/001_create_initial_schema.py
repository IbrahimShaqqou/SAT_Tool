"""Create initial schema for SAT tutoring platform

Revision ID: 001_initial_schema
Revises:
Create Date: 2024-01-15

This migration creates all tables for the question bank and tutoring system:
- Users (students, tutors, admins)
- Taxonomy (domains, subdomains, skills)
- Questions (with versioning and relations)
- Student responses and skill mastery
- Test sessions
- Assignments
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    # Enum values must match Python enum member names (SQLAlchemy uses names, not values)
    op.execute("CREATE TYPE userrole AS ENUM ('STUDENT', 'TUTOR', 'ADMIN')")
    op.execute("CREATE TYPE answertype AS ENUM ('MCQ', 'SPR')")
    op.execute("CREATE TYPE difficultylevel AS ENUM ('EASY', 'MEDIUM', 'HARD')")
    op.execute("CREATE TYPE testtype AS ENUM ('PRACTICE', 'ASSIGNED', 'DIAGNOSTIC', 'FULL_LENGTH')")
    op.execute("CREATE TYPE teststatus AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ABANDONED')")
    op.execute("CREATE TYPE assignmentstatus AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE')")
    op.execute("CREATE TYPE subjectarea AS ENUM ('MATH', 'READING_WRITING')")

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', postgresql.ENUM('STUDENT', 'TUTOR', 'ADMIN', name='userrole', create_type=False), nullable=False, default='STUDENT', index=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False, index=True),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('profile_data', postgresql.JSONB(), default={}, nullable=False),
        sa.Column('tutor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        comment='User accounts for students, tutors, and administrators'
    )
    op.create_index('ix_users_role_active', 'users', ['role', 'is_active'])
    op.create_index('ix_users_tutor_active', 'users', ['tutor_id', 'is_active'])

    # Create domains table
    op.create_table(
        'domains',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(10), unique=True, nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('subject_area', postgresql.ENUM('MATH', 'READING_WRITING', name='subjectarea', create_type=False), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), default=0, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Top-level SAT content domains'
    )
    op.create_index('ix_domains_subject_active', 'domains', ['subject_area', 'is_active'])

    # Create subdomains table
    op.create_table(
        'subdomains',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('domain_id', sa.Integer(), sa.ForeignKey('domains.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), default=0, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('domain_id', 'code', name='uq_subdomain_domain_code'),
        comment='Second-level content classification'
    )
    op.create_index('ix_subdomains_domain_active', 'subdomains', ['domain_id', 'is_active'])

    # Create skills table
    op.create_table(
        'skills',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('subdomain_id', sa.Integer(), sa.ForeignKey('subdomains.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('domain_id', sa.Integer(), sa.ForeignKey('domains.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('code', sa.String(30), nullable=False, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('primary_class_desc', sa.String(200), nullable=True),
        sa.Column('display_order', sa.Integer(), default=0, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('code', name='uq_skill_code'),  # Skill codes are unique globally
        comment='Individual skills (most granular classification)'
    )
    op.create_index('ix_skills_domain_active', 'skills', ['domain_id', 'is_active'])

    # Create questions table
    op.create_table(
        'questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('external_id', sa.String(100), unique=True, nullable=False, index=True),
        sa.Column('ibn', sa.String(50), nullable=True, index=True),
        sa.Column('subject_area', postgresql.ENUM('MATH', 'READING_WRITING', name='subjectarea', create_type=False), nullable=False, index=True),
        sa.Column('domain_id', sa.Integer(), sa.ForeignKey('domains.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('subdomain_id', sa.Integer(), sa.ForeignKey('subdomains.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('skill_id', sa.Integer(), sa.ForeignKey('skills.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('answer_type', postgresql.ENUM('MCQ', 'SPR', name='answertype', create_type=False), nullable=False, index=True),
        sa.Column('difficulty', postgresql.ENUM('EASY', 'MEDIUM', 'HARD', name='difficultylevel', create_type=False), nullable=True, index=True),
        sa.Column('score_band_range', sa.String(20), nullable=True),
        sa.Column('prompt_html', sa.Text(), nullable=False),
        sa.Column('choices_json', postgresql.JSONB(), nullable=True),
        sa.Column('correct_answer_json', postgresql.JSONB(), nullable=False),
        sa.Column('explanation_html', sa.Text(), nullable=True),
        # IRT parameters - TODO: Implement IRT calibration
        sa.Column('irt_difficulty_b', sa.Float(), nullable=True, comment='TODO: IRT difficulty parameter (b)'),
        sa.Column('irt_discrimination_a', sa.Float(), nullable=True, comment='TODO: IRT discrimination parameter (a)'),
        sa.Column('irt_guessing_c', sa.Float(), nullable=True, default=0.25, comment='TODO: IRT guessing parameter (c)'),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False, index=True),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('raw_import_json', postgresql.JSONB(), nullable=True),
        sa.Column('import_batch_id', sa.String(50), nullable=True, index=True),
        sa.Column('imported_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), default=1, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True, index=True),
        comment='SAT questions from College Board question bank'
    )
    op.create_index('ix_questions_domain_difficulty', 'questions', ['domain_id', 'difficulty'])
    op.create_index('ix_questions_skill_difficulty', 'questions', ['skill_id', 'difficulty'])
    op.create_index('ix_questions_subject_active', 'questions', ['subject_area', 'is_active'])
    op.create_index('ix_questions_type_difficulty', 'questions', ['answer_type', 'difficulty'])

    # Create question_versions table
    op.create_table(
        'question_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('change_reason', sa.String(500), nullable=True),
        sa.Column('content_snapshot', postgresql.JSONB(), nullable=False),
        sa.Column('changed_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('question_id', 'version_number', name='uq_question_version_number'),
        comment='Question version history for audit trail'
    )

    # Create question_relations table
    op.create_table(
        'question_relations',
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('related_question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('relation_type', sa.String(50), default='similar', nullable=False),
        sa.Column('similarity_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.CheckConstraint('question_id != related_question_id', name='ck_question_relations_not_self'),
        comment='Related questions mapping'
    )

    # Create assignments table (before test_sessions due to FK)
    op.create_table(
        'assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tutor_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('status', postgresql.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', name='assignmentstatus', create_type=False), default='PENDING', nullable=False, index=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('question_count', sa.Integer(), nullable=True),
        sa.Column('question_config', postgresql.JSONB(), nullable=True),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('target_score', sa.Integer(), nullable=True),
        sa.Column('actual_score', sa.Integer(), nullable=True),
        sa.Column('tutor_feedback', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Tutor-assigned practice sessions'
    )
    op.create_index('ix_assignments_student_status', 'assignments', ['student_id', 'status'])
    op.create_index('ix_assignments_tutor_status', 'assignments', ['tutor_id', 'status'])
    op.create_index('ix_assignments_due_date', 'assignments', ['due_date', 'status'])

    # Create test_sessions table
    op.create_table(
        'test_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('assignment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assignments.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('test_type', postgresql.ENUM('PRACTICE', 'ASSIGNED', 'DIAGNOSTIC', 'FULL_LENGTH', name='testtype', create_type=False), nullable=False, index=True),
        sa.Column('status', postgresql.ENUM('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ABANDONED', name='teststatus', create_type=False), default='NOT_STARTED', nullable=False, index=True),
        sa.Column('subject_area', postgresql.ENUM('MATH', 'READING_WRITING', name='subjectarea', create_type=False), nullable=True),
        sa.Column('title', sa.String(200), nullable=True),
        sa.Column('total_questions', sa.Integer(), nullable=False),
        sa.Column('question_config', postgresql.JSONB(), nullable=True),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=True),
        sa.Column('questions_answered', sa.Integer(), default=0, nullable=False),
        sa.Column('questions_correct', sa.Integer(), default=0, nullable=False),
        sa.Column('score_percentage', sa.Float(), nullable=True),
        sa.Column('scaled_score', sa.Integer(), nullable=True),
        sa.Column('current_question_index', sa.Integer(), default=0, nullable=False),
        sa.Column('session_state', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Test-taking sessions'
    )
    op.create_index('ix_test_sessions_student_status', 'test_sessions', ['student_id', 'status'])
    op.create_index('ix_test_sessions_student_type', 'test_sessions', ['student_id', 'test_type'])

    # Create student_responses table
    op.create_table(
        'student_responses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('test_session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('test_sessions.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('response_json', postgresql.JSONB(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False, index=True),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('confidence_level', sa.Integer(), nullable=True),
        sa.Column('flagged_for_review', sa.Boolean(), default=False, nullable=False),
        sa.Column('student_notes', sa.Text(), nullable=True),
        # IRT fields - TODO: Implement
        sa.Column('ability_estimate_before', sa.Float(), nullable=True, comment='TODO: Ability estimate before response'),
        sa.Column('ability_estimate_after', sa.Float(), nullable=True, comment='TODO: Ability estimate after response'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Student responses to questions'
    )
    op.create_index('ix_responses_student_question', 'student_responses', ['student_id', 'question_id'])
    op.create_index('ix_responses_student_correct', 'student_responses', ['student_id', 'is_correct'])
    op.create_index('ix_responses_session_order', 'student_responses', ['test_session_id', 'submitted_at'])
    op.create_index('ix_responses_student_submitted', 'student_responses', ['student_id', 'submitted_at'])

    # Create student_skills table
    op.create_table(
        'student_skills',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('skill_id', sa.Integer(), sa.ForeignKey('skills.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('mastery_level', sa.Float(), default=0.0, nullable=False),
        sa.Column('questions_attempted', sa.Integer(), default=0, nullable=False),
        sa.Column('questions_correct', sa.Integer(), default=0, nullable=False),
        sa.Column('last_practiced_at', sa.DateTime(timezone=True), nullable=True),
        # IRT fields - TODO: Implement
        sa.Column('ability_theta', sa.Float(), nullable=True, default=0.0, comment='TODO: IRT ability estimate'),
        sa.Column('ability_se', sa.Float(), nullable=True, comment='TODO: Standard error of estimate'),
        sa.Column('responses_for_estimate', sa.Integer(), default=0, nullable=False, comment='TODO: Responses used in estimate'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Student mastery levels per skill'
    )
    op.create_index('uq_student_skill', 'student_skills', ['student_id', 'skill_id'], unique=True)
    op.create_index('ix_student_skills_mastery', 'student_skills', ['student_id', 'mastery_level'])

    # Create test_questions table
    op.create_table(
        'test_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('test_session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('test_sessions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question_order', sa.Integer(), nullable=False),
        sa.Column('is_answered', sa.Boolean(), default=False, nullable=False),
        sa.Column('is_flagged', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Questions assigned to test sessions'
    )
    op.create_index('uq_test_question_order', 'test_questions', ['test_session_id', 'question_order'], unique=True)
    op.create_index('uq_test_question_unique', 'test_questions', ['test_session_id', 'question_id'], unique=True)

    # Create assignment_questions table
    op.create_table(
        'assignment_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('assignment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assignments.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('questions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question_order', sa.Integer(), nullable=False),
        sa.Column('is_required', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        comment='Questions in assignments'
    )
    op.create_index('uq_assignment_question_order', 'assignment_questions', ['assignment_id', 'question_order'], unique=True)
    op.create_index('uq_assignment_question_unique', 'assignment_questions', ['assignment_id', 'question_id'], unique=True)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('assignment_questions')
    op.drop_table('test_questions')
    op.drop_table('student_skills')
    op.drop_table('student_responses')
    op.drop_table('test_sessions')
    op.drop_table('assignments')
    op.drop_table('question_relations')
    op.drop_table('question_versions')
    op.drop_table('questions')
    op.drop_table('skills')
    op.drop_table('subdomains')
    op.drop_table('domains')
    op.drop_table('users')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS subjectarea")
    op.execute("DROP TYPE IF EXISTS assignmentstatus")
    op.execute("DROP TYPE IF EXISTS teststatus")
    op.execute("DROP TYPE IF EXISTS testtype")
    op.execute("DROP TYPE IF EXISTS difficultylevel")
    op.execute("DROP TYPE IF EXISTS answertype")
    op.execute("DROP TYPE IF EXISTS userrole")
