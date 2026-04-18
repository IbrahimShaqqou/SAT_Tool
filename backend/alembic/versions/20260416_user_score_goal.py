"""Add target_score and test_date to users

Revision ID: 20260416_user_score_goal
Revises: 20260410_question_explanations
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = "20260416_user_score_goal"
down_revision = "20260410_question_explanations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("target_score", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("test_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "test_date")
    op.drop_column("users", "target_score")
