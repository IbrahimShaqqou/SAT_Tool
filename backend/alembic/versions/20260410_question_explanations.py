"""Add question_explanations table

Revision ID: 20260410_question_explanations
Revises: 20260408_needs_image_review
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260410_question_explanations"
down_revision = "20260408_needs_image_review"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "question_explanations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("question_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("questions.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("explanation_type", sa.String(20), nullable=False),
        sa.Column("steps_json", postgresql.JSONB(), nullable=False),
        sa.Column("model_used", sa.String(100), nullable=False),
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "explanation_type IN ('math', 'reading', 'grammar')",
            name="ck_qe_explanation_type"
        ),
    )
    op.create_index("ix_qe_question_id", "question_explanations", ["question_id"])
    op.create_index("ix_qe_type", "question_explanations", ["explanation_type"])


def downgrade() -> None:
    op.drop_index("ix_qe_type", table_name="question_explanations")
    op.drop_index("ix_qe_question_id", table_name="question_explanations")
    op.drop_table("question_explanations")
