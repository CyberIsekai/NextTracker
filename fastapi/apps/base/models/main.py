# pylint: disable=unused-import, multiple-statements
from sqlalchemy import (
    Column,
    Integer,
    SmallInteger,
    String,
    Text,
    TIMESTAMP,
    JSON,
)
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB

from core.config import settings
from core.database import Base

from apps.base.schemas.main import C
from apps.base.models.abstracts import Logs, LogsRequest, Translate
from apps.notes.models.main import notes
from apps.tracker.models.main import (
    cod_players,
    cod_logs,
    cod_logs_error,
    cod_logs_search,
    cod_matches_mw_wz,
    cod_matches_mw_mp,
    cod_matches_cw_mp,
    cod_matches_vg_mp,
    cod_fullmatches_mw_mp,
    cod_fullmatches_mw_wz_2020,
    cod_fullmatches_mw_wz_2021,
    cod_fullmatches_mw_wz_2022,
    cod_fullmatches_basic_mw_mp,
    cod_fullmatches_basic_mw_wz_2020,
    cod_fullmatches_basic_mw_wz_2021,
    cod_fullmatches_basic_mw_wz_2022,
)


class Users(Base):
    id = Column(Integer, primary_key=True, index=True)
    status = Column(SmallInteger, nullable=False, server_default='0')
    login = Column(
        String(settings.NAME_LIMIT_2), nullable=False, unique=True, index=True
    )
    password = Column(Text, nullable=False)
    email = Column(String(settings.NAME_LIMIT_2), index=True)
    username = Column(String(settings.NAME_LIMIT_2))
    data = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'{}')
    language = Column(String(5), nullable=False, server_default=C.EN)
    roles = Column(JSON, nullable=False, server_default=f'["{C.USER}"]')
    time = Column(
        TIMESTAMP,
        nullable=False,
        server_default=func.current_timestamp(),
    )

    class Config:
        orm_mode = True


class users_role(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(settings.NAME_LIMIT), nullable=False, unique=True)
    level = Column(SmallInteger, nullable=False, server_default='0')
    access = Column(JSON, nullable=False, server_default=r'[]')
    pages = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'{}')


class configs(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(settings.NAME_LIMIT), nullable=False)
    source = Column(String(settings.NAME_LIMIT), nullable=False)
    data = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'{}')
    time = Column(
        TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.now()
    )


class logs(Logs): ...


class logs_user(Logs): ...


class logs_error(Logs): ...


class logs_url(Logs): ...


class logs_ip(Logs): ...


class logs_request(LogsRequest): ...


class logs_request_error(LogsRequest): ...


class logs_request_auth(LogsRequest):
    message = Column(String(400), index=True)


class translate(Translate): ...


class translate_stats(Translate): ...
