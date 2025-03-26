from sqlalchemy.sql import func
from sqlalchemy import Column, Integer, TIMESTAMP, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from core.database import Base
from core.config import settings


class Logs(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    target = Column(String(settings.NAME_LIMIT_2), nullable=False)
    message = Column(Text)
    data = Column(JSONB(astext_type=Text()))
    time = Column(TIMESTAMP, index=True, server_default=func.current_timestamp())


class LogsRequest(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    client = Column(String(settings.NAME_LIMIT_2), nullable=False, index=True)
    path = Column(String(400), nullable=False, index=True)
    user_agent = Column(String(400))
    data = Column(JSONB(astext_type=Text()))
    time = Column(TIMESTAMP, index=True, server_default=func.current_timestamp())


class Translate(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(settings.NAME_LIMIT_2), nullable=False, unique=True)
    en = Column(String(settings.NAME_LIMIT_2))
    ru = Column(String(settings.NAME_LIMIT_2))
