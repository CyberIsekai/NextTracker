from sqlalchemy import Column, Integer, TIMESTAMP, String, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from core.config import settings
from core.database import Base


class notes(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(settings.NAME_LIMIT_2), index=True)
    data = Column(JSONB(astext_type=Text()))
    completed = Column(Boolean, server_default='false')
    time = Column(TIMESTAMP, index=True, server_default=func.current_timestamp())
