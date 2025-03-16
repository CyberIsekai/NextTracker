from sqlalchemy import Column, TIMESTAMP, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from core.config import settings
from core.database import Base

from apps.base.models.main import Logs

from apps.tracker.models.abstracts import (
    cod_label,
    matches_mw_wz,
    matches_mw_mp,
    matches_cw_mp,
    matches_vg_mp,
    fullmatches_mw_wz,
    fullmatches_mw_mp,
    fullmatches_mw_mp_basic,
    fullmatches_mw_wz_basic,
)


class cod_players(Base):
    id = Column(Integer, primary_key=True, index=True)

    uno = Column(String(settings.NAME_LIMIT_2), index=True, nullable=False, unique=True)
    acti = Column(String(settings.NAME_LIMIT_2))
    battle = Column(String(settings.NAME_LIMIT_2))
    username = Column(JSON, nullable=False, server_default=r'[]')
    clantag = Column(JSON, nullable=False, server_default=r'[]')

    group = Column(String(settings.NAME_LIMIT_2))
    games = Column(JSONB(astext_type=Text()))
    games_stats = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'{}')
    data = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'{}')

    chart = Column(JSONB(astext_type=Text()))
    most_play_with = Column(JSONB(astext_type=Text()))
    loadout = Column(JSONB(astext_type=Text()))

    time = Column(TIMESTAMP, nullable=False, server_default=func.current_timestamp())


class cod_label_map(cod_label): ...


class cod_label_mode(cod_label): ...


class cod_label_weapons(cod_label): ...


class cod_label_attachments(cod_label): ...


class cod_label_perks(cod_label): ...


class cod_label_killstreaks(cod_label): ...


class cod_label_tactical(cod_label): ...


class cod_label_lethal(cod_label): ...


class cod_label_games_stats(cod_label): ...


class cod_logs_search(Base):
    id = Column(Integer, primary_key=True, index=True)
    target = Column(String(settings.NAME_LIMIT), nullable=False, index=True)
    uno = Column(String(settings.NAME_LIMIT), index=True)
    data = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'[]')
    time = Column(TIMESTAMP, index=True, server_default=func.current_timestamp())


class cod_logs_task_queues(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(settings.NAME_LIMIT_2), nullable=False)
    status = Column(String(settings.NAME_LIMIT), nullable=False)
    data = Column(JSONB(astext_type=Text()), nullable=False, server_default=r'{}')
    time = Column(TIMESTAMP, index=True, server_default=func.current_timestamp())
    time_started = Column(TIMESTAMP)
    time_end = Column(TIMESTAMP)


class cod_logs(Logs): ...


class cod_logs_player(Logs): ...


class cod_logs_error(Logs): ...


class cod_matches_mw_mp(matches_mw_mp): ...


class cod_matches_mw_wz(matches_mw_wz): ...


class cod_matches_cw_mp(matches_cw_mp): ...


class cod_matches_vg_mp(matches_vg_mp): ...


class cod_fullmatches_mw_mp(fullmatches_mw_mp): ...


class cod_fullmatches_mw_wz_2020(fullmatches_mw_wz): ...


class cod_fullmatches_mw_wz_2021(fullmatches_mw_wz): ...


class cod_fullmatches_mw_wz_2022(fullmatches_mw_wz): ...


class cod_fullmatches_mw_wz_2023(fullmatches_mw_wz): ...


class cod_fullmatches_basic_mw_mp(fullmatches_mw_mp_basic): ...


class cod_fullmatches_basic_mw_wz_2020(fullmatches_mw_wz_basic): ...


class cod_fullmatches_basic_mw_wz_2021(fullmatches_mw_wz_basic): ...


class cod_fullmatches_basic_mw_wz_2022(fullmatches_mw_wz_basic): ...


class cod_fullmatches_basic_mw_wz_2023(fullmatches_mw_wz_basic): ...
