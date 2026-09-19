from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid

from app.database import Base
from app.models.base import TimestampMixin


class SessionReplay(Base, TimestampMixin):
    __tablename__ = "session_replays"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String, nullable=False, unique=True, index=True)
    page_url = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    events = Column(JSONB, nullable=False, default=list)
    duration_ms = Column(Integer, nullable=False, default=0)
