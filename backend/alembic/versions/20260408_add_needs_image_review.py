"""Add needs_image_review column to questions

Revision ID: 20260408_needs_image_review
Revises: 20260127_add_mastery_level_enum_fields
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = "20260408_needs_image_review"
down_revision = "20260127_mastery_levels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column(
            "needs_image_review",
            sa.Boolean(),
            nullable=False,
            server_default="false",
            comment="Question contains a raster graph/diagram image that should be replaced with SVG/HTML",
        ),
    )


def downgrade() -> None:
    op.drop_column("questions", "needs_image_review")
