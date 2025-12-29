"""Add intake assessment fields to invites

Revision ID: 20251228_intake
Revises: 20251228_adaptive
Create Date: 2024-12-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251228_intake'
down_revision = '20251228_adaptive'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create assessment_type enum
    assessment_type_enum = postgresql.ENUM(
        'intake', 'section', 'domain', 'quick_check',
        name='assessmenttype',
        create_type=False
    )
    assessment_type_enum.create(op.get_bind(), checkfirst=True)

    # Add assessment_type column to invites
    op.add_column(
        'invites',
        sa.Column(
            'assessment_type',
            sa.Enum('intake', 'section', 'domain', 'quick_check', name='assessmenttype'),
            nullable=False,
            server_default='intake',
            comment='Type of assessment: intake, section, domain, or quick_check'
        )
    )

    # Add is_adaptive column to invites
    op.add_column(
        'invites',
        sa.Column(
            'is_adaptive',
            sa.Integer(),
            nullable=False,
            server_default='1',
            comment='Whether to use adaptive (CAT) question selection'
        )
    )


def downgrade() -> None:
    # Drop columns
    op.drop_column('invites', 'is_adaptive')
    op.drop_column('invites', 'assessment_type')

    # Drop enum type
    op.execute('DROP TYPE IF EXISTS assessmenttype')
