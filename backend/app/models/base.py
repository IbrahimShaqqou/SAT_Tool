"""
SAT Tutoring Platform - Base Model Mixins

Common columns and behaviors shared across models.
"""

from sqlalchemy import Column, DateTime, Integer, func


class TimestampMixin:
    """
    Mixin providing created_at and updated_at timestamps.

    Automatically sets created_at on insert and updated_at on update.
    """

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Record creation timestamp"
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Record last update timestamp"
    )


class SoftDeleteMixin:
    """
    Mixin for soft delete functionality.

    Records are marked as deleted rather than physically removed,
    preserving referential integrity and audit trails.
    """

    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Soft delete timestamp, NULL if active"
    )

    @property
    def is_deleted(self) -> bool:
        """Check if record is soft-deleted."""
        return self.deleted_at is not None


class VersionMixin:
    """
    Mixin for optimistic locking via version number.
    """

    version = Column(
        Integer,
        default=1,
        nullable=False,
        comment="Version number for optimistic locking"
    )
