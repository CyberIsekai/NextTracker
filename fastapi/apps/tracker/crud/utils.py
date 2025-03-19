import asyncio
import csv
import datetime
import inspect
import time
from typing import Literal
from collections import Counter

from sqlalchemy import select, union_all, func, desc, text
from sqlalchemy.orm import Session
from fastapi import WebSocket

from core.config import settings

from apps.base.crud.store_tables import SBT
from apps.base.crud.utils_data_init import LOGS_TABLES
from apps.base.schemas.main import C, STask, STaskStatus
from apps.base.crud.utils import (
    get_delay,
    in_logs,
    in_logs_cod_logs_cache,
    now,
    seconds_wait_expire,
    to_dict,
    log_time_wrap,
    redis_manage,
    date_format,
    config_get,
    is_number,
    get_stats_row,
)

from apps.tracker.crud.store_tables import STT
from apps.tracker.crud.store_game_modes import SGM
from apps.tracker.crud.utils_data_init import (
    GAMES_LIST,
    MATCHES_STATS,
)
from apps.tracker.models.main import cod_players
from apps.tracker.schemas.main import (
    GameModeMw,
    MostCommonUnoData,
    MostPlayWithData,
    SGame,
    GameStatusLog,
    GroupData,
    Player,
    PlayerBasic,
    PlayerColumnType,
    PlayerData,
    TargetDataBasic,
    TrackerStats,
    GamesStatus,
    SearchResp,
    Task,
    TrackerStatsValue,
    GameStats,
    GameStatsDataLifetime,
    GameStatsDataLifetimeCW,
    Chart,
    MostPlayWith,
    Loadout,
    StatsRow,
    GameOnly,
    DataTypeOnly,
    DataType,
    Game,
    Mode,
    GameMode,
    GameModeOnly,
    YearWzTable,
    TaskStatus,
    TargetType,
)


def search_uno_tags(db: Session, uno: str, column: Literal['username', 'clantag']):
    game_tables = STT.get_tables(C.ALL, C.ALL, C.ALL)
    selects = [
        select(t.table.uno, t.table.time, t.table.__dict__[column]) for t in game_tables
    ]
    all_entries = union_all(*selects).cte(name='all_entries')
    entry_column = all_entries.c.get(column)
    subq = (
        select(
            entry_column,
            func.max(all_entries.c.time).label('latest_time'),
        )
        .filter(
            all_entries.c.uno == uno,
            entry_column.isnot(None),
        )
        .group_by(entry_column)
        .subquery()
    )
    query = select(subq.c.get(column)).order_by(subq.c.latest_time.desc())
    result = db.execute(query)

    return [row[0] for row in result]


def most_common_uno_game_mode_get(db: Session, game_mode: GameMode):
    game, mode = SGM.desctruct_game_mode(game_mode)
    game_tables = STT.get_tables(game, mode, C.ALL)
    selects = [select(t.table.uno) for t in game_tables]
    all_entries = union_all(*selects).cte(name='all_entries')
    query = (
        select(all_entries.c.uno, func.count(all_entries.c.uno).label(C.COUNT))
        .group_by(all_entries.c.uno)
        .having(func.count(all_entries.c.uno) > 100)
        .order_by(desc(text(C.COUNT)))
        .limit(1000)
    )
    query_result = db.execute(query)
    most_common_uno_game_mode: list[MostCommonUnoData] = [
        {
            C.UNO: row.uno,
            C.COUNT: row.count,
            C.USERNAME: search_uno_tags(db, row.uno, C.USERNAME),
            C.CLANTAG: search_uno_tags(db, row.uno, C.CLANTAG),
        }
        for row in query_result
    ]

    return most_common_uno_game_mode


# @log_time_wrap
# def most_play_with_update(db: Session):
#     group_unos = defaultdict(set[str])
#     player_to_group: dict[str, str] = {}
#     for uno in target_unos_get(C.PLAYER):
#         player_group = redis_manage(f'{C.PLAYER}:{C.UNO}_{uno}', 'hget', C.GROUP)
#         player_to_group[uno] = player_group
#         group_unos[player_group].add(uno)

#     group_unos[C.ALL] = set(player_to_group)
#     game_modes = (C.ALL, C.MW_MP, C.MW_WZ)
#     source = C.MAIN
#     targets: dict[
#         str, dict[Literal['all', 'mw_mp', 'mw_wz'], defaultdict[str, int]]
#     ] = {
#         uno: {game_mode: defaultdict(int) for game_mode in game_modes}
#         for uno in (set(group_unos[C.ALL]) | set(group_unos) | {C.TRACKER})
#     }

#     for game_mode, (game, mode) in SGM.modes(C.MW).items():
#         tables = STT.get_tables(game, mode, source)
#         all_matches = fill_all_matches(db, tables, group_unos[C.ALL])

#         for match_unos in all_matches:
#             # summary all matches
#             for match_uno in match_unos:
#                 targets[C.TRACKER][game_mode][match_uno] += 1
#                 targets[C.TRACKER][C.ALL][match_uno] += 1
#             # summary only matches that have registered player
#             for player_uno in match_unos & group_unos[C.ALL]:
#                 player_group = player_to_group[player_uno]
#                 for match_uno in match_unos - {player_uno}:
#                     targets[player_uno][game_mode][match_uno] += 1
#                     targets[player_uno][C.ALL][match_uno] += 1

#                     for group_uno in (player_group, C.ALL):
#                         if match_uno not in group_unos[group_uno]:
#                             targets[group_uno][game_mode][match_uno] += 1
#                             targets[group_uno][C.ALL][match_uno] += 1

#     uno_to_username: dict[str, str] = {}

#     for game_mode in game_modes:
#         game, mode = SGM.desctruct_game_mode(game_mode)
#         tables = STT.get_tables(game, mode, source)

#         for uno, most_play_with in targets.items():
#             most_play_with[game_mode] = sorted(  # list[MostPlayWithData]
#                 (
#                     {C.UNO: uno, C.COUNT: count, C.USERNAME: ''}
#                     for uno, count in most_play_with[game_mode].items()
#                     if count > 1
#                 ),
#                 key=lambda x: x[C.COUNT],
#                 reverse=True,
#             )[:50]

#             # identification every uno to username
#             for most_play in most_play_with[game_mode]:
#                 if most_play[C.UNO] not in uno_to_username:
#                     for t in tables:
#                         player = (
#                             db.query(t.table.username)
#                             .filter(t.table.uno == most_play[C.UNO])
#                             .first()
#                         )
#                         if player and player.username:
#                             uno_to_username[most_play[C.UNO]] = player.username
#                             break
#                 most_play[C.USERNAME] = uno_to_username[most_play[C.UNO]]

#     for uno, most_play_with in targets.items():
#         target_data_stats_save(db, uno, C.MOST_PLAY_WITH, most_play_with)


@log_time_wrap
def most_play_with_update(db: Session):
    # TODO add most_play_with stats for groups
    most_common_uno_all = most_common_uno_game_mode_get(db, C.ALL)
    TOP_LIMIT = 50
    time_now = now(C.ISO)
    most_play_with: MostPlayWith = {
        C.ALL: sorted(
            [
                {
                    C.UNO: most_common_uno[C.UNO],
                    C.COUNT: most_common_uno[C.COUNT],
                    C.USERNAME: most_common_uno[C.USERNAME][0],
                    C.CLANTAG: (
                        most_common_uno[C.CLANTAG][0]
                        if most_common_uno[C.CLANTAG]
                        else ''
                    ),
                }
                for most_common_uno in most_common_uno_all
            ],
            key=lambda x: x[C.COUNT],
            reverse=True,
        )[: TOP_LIMIT * 2],
        C.MW_MP: [],
        C.MW_WZ: [],
        C.TIME: time_now,
    }

    uno_tags: dict[str, dict[Literal['username', 'clantag'], str]] = {}
    players: dict[
        str,
        dict[Literal['most_play_with'], MostPlayWith]
        | dict[Literal['fullmatches'], dict[GameModeMw, int]],
    ] = {}

    for most_common_uno in most_common_uno_all:
        players[most_common_uno[C.UNO]] = {
            C.MOST_PLAY_WITH: {
                C.ALL: [],
                C.MW_MP: [],
                C.MW_WZ: [],
                C.TIME: time_now,
            },
            C.FULLMATCHES: {
                C.MW_MP: 0,
                C.MW_WZ: 0,
            },
        }
        uno_tags[most_common_uno[C.UNO]] = {
            C.USERNAME: most_common_uno[C.USERNAME][0],
            C.CLANTAG: (
                most_common_uno[C.CLANTAG][0] if most_common_uno[C.CLANTAG] else ''
            ),
        }

    for game_mode, (game, mode) in SGM.modes(C.MW, C.ALL).items():
        game_tables = STT.get_tables(game, mode, C.ALL)

        selects = [select(t.table.uno, t.table.matchID) for t in game_tables]
        all_entries = union_all(*selects).cte(name='all_entries')

        all_matches: dict[str, list[str]] = {}

        for index, most_common_uno in enumerate(most_common_uno_all):

            uno: str = most_common_uno[C.UNO]

            player_matches_count = Counter()
            result = db.execute(
                select(all_entries.c.matchID).where(all_entries.c.uno == uno)
            )
            player_matches_list = [row.matchID for row in result]

            players[uno][C.FULLMATCHES][game_mode] = len(player_matches_list)
            most_play_with[game_mode].append(
                {
                    C.UNO: uno,
                    C.COUNT: len(player_matches_list),
                }
                | uno_tags[uno]
            )

            for matchID in player_matches_list:

                if matchID not in all_matches:
                    result = db.execute(
                        select(all_entries.c.uno).where(
                            all_entries.c.matchID == matchID
                        )
                    )
                    match_unos = [row.uno for row in result]

                    # check on doubles in a match
                    unic_unos = set(match_unos)
                    if len(unic_unos) != len(match_unos):
                        # clear_fullmatches_doubles(db, matchID, game_mode) TODO
                        all_matches[matchID] = list(unic_unos)
                    else:
                        all_matches[matchID] = match_unos

                for match_uno in all_matches[matchID]:
                    # count all players in a match that play with this uno
                    if match_uno != uno:
                        player_matches_count[match_uno] += 1

            player_matches_count_top = sorted(
                [i for i in player_matches_count.items() if i[1] > 2],
                key=lambda x: x[1],
                reverse=True,
            )[:TOP_LIMIT]

            for match_uno, count in player_matches_count_top:

                if match_uno not in uno_tags:
                    for t in game_tables:
                        find = (
                            db.query(t.table.username, t.table.clantag)
                            .filter(t.table.uno == match_uno)
                            .first()
                        )
                        if find and find.username:
                            uno_tags[match_uno] = {
                                C.USERNAME: find.username,
                                C.CLANTAG: find.clantag or '',
                            }
                            break

                players[uno][C.MOST_PLAY_WITH][game_mode].append(
                    {
                        C.UNO: match_uno,
                        C.COUNT: count,
                    }
                    | uno_tags[match_uno]
                )

            if (index % 10) == 0:
                current_percent = int(index / len(most_common_uno_all) * 100)
                print(most_play_with_update.__name__, game_mode, f'{current_percent}%')

    for most_common_uno in most_common_uno_all:
        uno: str = most_common_uno[C.UNO]

        # summary player most play with game modes
        player_most_play_with_all: dict[str, MostPlayWithData] = {}

        for game_mode in SGM.modes(C.MW, C.ALL):

            for most_play_with_game_mode in players[uno][C.MOST_PLAY_WITH][game_mode]:

                if most_play_with_game_mode[C.UNO] not in player_most_play_with_all:
                    player_most_play_with_all[most_play_with_game_mode[C.UNO]] = (
                        most_play_with_game_mode.copy()
                    )
                else:
                    player_most_play_with_all[most_play_with_game_mode[C.UNO]][
                        C.COUNT
                    ] += most_play_with_game_mode[C.COUNT]

        players[uno][C.MOST_PLAY_WITH][C.ALL] = sorted(
            player_most_play_with_all.values(),
            key=lambda x: x[C.COUNT],
            reverse=True,
        )[:TOP_LIMIT]

        if games := player_get(db, uno, C.GAMES, most_play_with_update.__name__):
            games[C.MW_MP][C.MATCHES][C.STATS][C.FULLMATCHES] = players[uno][
                C.FULLMATCHES
            ][C.MW_MP]
            games[C.MW_WZ][C.MATCHES][C.STATS][C.FULLMATCHES] = players[uno][
                C.FULLMATCHES
            ][C.MW_WZ]
            player_get(db, uno, C.RAW, most_play_with_update.__name__).update(
                {
                    STT.players.username: most_common_uno[C.USERNAME],
                    STT.players.clantag: most_common_uno[C.CLANTAG],
                    STT.players.games: games,
                    STT.players.most_play_with: players[uno][C.MOST_PLAY_WITH],
                }
            )
        else:
            save_player = STT.players(
                uno=uno,
                username=most_common_uno[C.USERNAME],
                clantag=most_common_uno[C.CLANTAG],
                games=games_create(
                    uno,
                    {
                        C.MW_MP: {
                            C.STATUS: 1 if players[uno][C.FULLMATCHES][C.MW_MP] else 0,
                            C.FULLMATCHES: players[uno][C.FULLMATCHES][C.MW_MP],
                        },
                        C.MW_WZ: {
                            C.STATUS: 1 if players[uno][C.FULLMATCHES][C.MW_WZ] else 0,
                            C.FULLMATCHES: players[uno][C.FULLMATCHES][C.MW_WZ],
                        },
                        C.CW_MP: {
                            C.STATUS: 0,
                            C.FULLMATCHES: 0,
                        },
                        C.VG_MP: {
                            C.STATUS: 0,
                            C.FULLMATCHES: 0,
                        },
                    },
                    most_play_with_update.__name__,
                ),
                most_play_with=players[uno][C.MOST_PLAY_WITH],
            )
            db.add(save_player)
        db.commit()

    most_play_with[C.MW_MP] = sorted(
        most_play_with[C.MW_MP],
        key=lambda x: x[C.COUNT],
        reverse=True,
    )[: TOP_LIMIT * 2]
    most_play_with[C.MW_WZ] = sorted(
        most_play_with[C.MW_WZ],
        key=lambda x: x[C.COUNT],
        reverse=True,
    )[: TOP_LIMIT * 2]

    return most_play_with


def games_create(
    uno: str,
    game_statuses: dict[
        GameModeOnly,
        dict[Literal['status'], Literal[0, 1, 2]]  # SGame
        | dict[Literal['fullmatches'], int],
    ],
    source: str,
):
    log: GameStatusLog = {
        C.UNO: uno,
        C.GAME_MODE: C.MW_MP,
        'records': 0,
        C.SOURCE: f'{games_create.__dict__} {source}',
        C.TIME: now(C.ISO),
    }

    games: GamesStatus = {
        C.ALL: {
            C.STATUS: 0,
            C.MATCHES: {
                C.STATS: {
                    C.MATCHES: 0,
                    C.FULLMATCHES: sum(
                        (
                            game_status[C.FULLMATCHES]
                            for game_status in game_statuses.values()
                        )
                    ),
                    C.PLAYED: 0,
                },
                C.LOGS: [log],
            },
            C.STATS: {C.LOGS: [log]},
        },
        C.MW_MP: {
            C.STATUS: game_statuses[C.MW_MP][C.STATUS],
            C.MATCHES: {
                C.STATS: {
                    C.MATCHES: 0,
                    C.FULLMATCHES: game_statuses[C.MW_MP][C.FULLMATCHES],
                    C.PLAYED: 0,
                },
                C.LOGS: [log],
            },
            C.STATS: {C.LOGS: [log]},
        },
        C.MW_WZ: {
            C.STATUS: game_statuses[C.MW_WZ][C.STATUS],
            C.MATCHES: {
                C.STATS: {
                    C.MATCHES: 0,
                    C.FULLMATCHES: game_statuses[C.MW_WZ][C.FULLMATCHES],
                    C.PLAYED: 0,
                },
                C.LOGS: [log | {C.GAME_MODE: C.MW_WZ}],
            },
            C.STATS: {C.LOGS: [log | {C.GAME_MODE: C.MW_WZ}]},
        },
        C.CW_MP: {
            C.STATUS: game_statuses[C.CW_MP][C.STATUS],
            C.MATCHES: {
                C.STATS: {
                    C.MATCHES: 0,
                    C.FULLMATCHES: game_statuses[C.CW_MP][C.FULLMATCHES],
                    C.PLAYED: 0,
                },
                C.LOGS: [log | {C.GAME_MODE: C.CW_MP}],
            },
            C.STATS: {C.LOGS: [log | {C.GAME_MODE: C.CW_MP}]},
        },
        C.VG_MP: {
            C.STATUS: game_statuses[C.VG_MP][C.STATUS],
            C.MATCHES: {
                C.STATS: {
                    C.MATCHES: 0,
                    C.FULLMATCHES: game_statuses[C.VG_MP][C.FULLMATCHES],
                    C.PLAYED: 0,
                },
                C.LOGS: [log | {C.GAME_MODE: C.VG_MP}],
            },
            C.STATS: {C.LOGS: [log | {C.GAME_MODE: C.VG_MP}]},
        },
    }

    return games


@log_time_wrap
def tracker_stats_update(db: Session) -> TrackerStats:
    '''Count and save rows for every game table, with last added id'''

    matches: dict[GameMode, StatsRow] = {
        C.ALL: get_stats_row(db, None),
        C.MW_MP: get_stats_row(db, STT.get_table(C.MW_MP, C.MATCHES).table),
        C.MW_WZ: get_stats_row(db, STT.get_table(C.MW_WZ, C.MATCHES).table),
        C.CW_MP: get_stats_row(db, STT.get_table(C.CW_MP, C.MATCHES).table),
        C.VG_MP: get_stats_row(db, STT.get_table(C.VG_MP, C.MATCHES).table),
    }
    matches[C.ALL][C.ROWS] = sum(map(lambda x: x[C.ROWS], matches.values()))

    fullmatches_main = {
        C.ALL: get_stats_row(db, None),
        C.MW_MP: get_stats_row(db, STT.get_table(C.MW_MP, C.MAIN).table),
        C.MW_WZ: {
            year: get_stats_row(db, STT.get_table(C.MW_WZ, C.MAIN, year).table)
            for year in YearWzTable.__args__
        },
        C.CW_MP: get_stats_row(db, None),
        C.VG_MP: get_stats_row(db, None),
    }
    fullmatches_main[C.MW_WZ][C.ALL] = {
        C.ROWS: sum(map(lambda x: x[C.ROWS], fullmatches_main[C.MW_WZ].values())),
        'last_id': 0,
    }
    fullmatches_main[C.ALL][C.ROWS] = (
        fullmatches_main[C.MW_MP][C.ROWS] + fullmatches_main[C.MW_WZ][C.ALL][C.ROWS]
    )

    fullmatches_basic = {
        C.ALL: get_stats_row(db, None),
        C.MW_MP: get_stats_row(db, STT.get_table(C.MW_MP, C.BASIC).table),
        C.MW_WZ: {
            year: get_stats_row(db, STT.get_table(C.MW_WZ, C.BASIC, year).table)
            for year in YearWzTable.__args__
        },
        C.CW_MP: get_stats_row(db, None),
        C.VG_MP: get_stats_row(db, None),
    }
    fullmatches_basic[C.MW_WZ][C.ALL] = {
        C.ROWS: sum(map(lambda x: x[C.ROWS], fullmatches_basic[C.MW_WZ].values())),
        'last_id': 0,
    }
    fullmatches_basic[C.ALL][C.ROWS] = (
        fullmatches_basic[C.MW_MP][C.ROWS] + fullmatches_basic[C.MW_WZ][C.ALL][C.ROWS]
    )

    summary = {
        C.ALL: 0,
        C.MW_MP: 0,
        C.MW_WZ: 0,
        C.CW_MP: 0,
        C.VG_MP: 0,
    }
    # summary matches
    for game_mode in SGM.modes():
        summary[game_mode] += matches[game_mode][C.ROWS]
    # summary fullmatches
    summary[C.MW_MP] += fullmatches_main[C.MW_MP][C.ROWS]
    summary[C.MW_WZ] += fullmatches_main[C.MW_WZ][C.ALL][C.ROWS]
    summary[C.MW_MP] += fullmatches_basic[C.MW_MP][C.ROWS]
    summary[C.MW_WZ] += fullmatches_basic[C.MW_WZ][C.ALL][C.ROWS]

    summary[C.ALL] = sum(summary.values())

    data: TrackerStatsValue = {
        C.MATCHES: matches,
        'fullmatches_main': fullmatches_main,
        'fullmatches_basic': fullmatches_basic,
        C.SUMMARY: summary,
        'non_matches': {
            C.PLAYERS: get_stats_row(db, STT.players),
            'cod_logs': get_stats_row(db, STT.cod_logs),
            'cod_logs_error': get_stats_row(db, STT.cod_logs_error),
            'cod_logs_search': get_stats_row(db, STT.cod_logs_search),
            'cod_logs_task_queues': get_stats_row(db, STT.cod_logs_task_queues),
        },
        C.MOST_PLAY_WITH: most_play_with_update(db),
    }

    config_get(db, C.STATS, C.TRACKER).update(
        {SBT.configs.data: data, SBT.configs.time: now()}
    )
    db.commit()

    return {C.DATA: data, C.TIME: now(C.ISO)}


async def send(ws: WebSocket, message: str, status: int, result=None):
    resp: SearchResp = {
        C.MESSAGE: message,
        C.STATUS: status,
        C.RESULT: result,
        C.TIME: now(C.ISO),
    }
    await ws.send_json(resp)
    await asyncio.sleep(0.1)


def player_get(db: Session, uno: str, column_type: PlayerColumnType, source: str):
    in_logs(
        uno,
        f'[{player_get.__name__}] {column_type} {source}',
        'cod_logs_player',
    )

    filter_by = STT.players.uno == uno

    if column_type == C.BASIC:
        player: PlayerBasic | None = (
            db.query(*STT.players_basic).filter(filter_by).first()
        )
        if player is None:
            return
        player = to_dict(player)
        player[C.TIME] = date_format(player[C.TIME], C.ISO)
        return player

    if column_type == C.RAW:
        return db.query(STT.players).filter(filter_by)

    if column_type == C.ALL:
        player: Player | None = db.query(STT.players).filter(filter_by).first()
        if player is None:
            return
        player = to_dict(player)
        player[C.TIME] = date_format(player[C.TIME], C.ISO)
        return player

    column = STT.players.__dict__.get(column_type)
    player = db.query(column).filter(filter_by).first()
    return player[0] if player else player


def target_type_define(uno: str) -> TargetType:
    return C.PLAYER if uno.isdigit() else C.GROUP


def in_logs_game_status(
    db: Session,
    uno: str,
    game_mode: GameModeOnly,
    data_type: DataTypeOnly,
    records: int,
):
    target_type = target_type_define(uno)

    if target_type == C.PLAYER:
        games = player_get(
            db,
            uno,
            C.GAMES,
            f'{in_logs_game_status.__name__} {game_mode=} {data_type=} {records=}',
        )
    else:
        games = redis_manage(f'{target_type}:{C.UNO}_{uno}', 'hget', C.GAMES)

    if data_type == C.STATS and records:
        games[game_mode][C.MATCHES][C.STATS][C.PLAYED] = records

    logs_type = C.STATS if data_type == C.STATS else C.MATCHES
    logs: list[GameStatusLog] = games[game_mode][logs_type][C.LOGS]

    last_log = logs[0]
    if last_log[C.SOURCE] != C.MATCHES and seconds_wait_expire(
        last_log[C.TIME],
        datetime.timedelta(seconds=60),
    ):
        logs.remove(last_log)

    logs.insert(
        0,
        {
            C.UNO: uno,
            C.GAME_MODE: game_mode,
            C.SOURCE: data_type,
            'records': records,
            C.TIME: now(C.ISO),
        },
    )

    set_games(db, uno, games)


def group_players_games(games_list: list[GamesStatus]):
    games_all = {
        game_mode: {
            C.STATUS: 1 if game_mode == C.ALL else 0,
            C.MATCHES: {C.STATS: MATCHES_STATS.copy(), C.LOGS: []},
            C.STATS: {C.LOGS: []},
        }
        for game_mode in SGM.modes(C.ALL, C.ALL)
    }
    for games in games_list:
        for game_mode in SGM.modes():
            # if player have enabled game, enable for group
            if games[game_mode][C.STATUS] != SGame.DISABLED:
                games_all[game_mode][C.STATUS] = SGame.ENABLED

            # summary matches and stats logs
            games_all[game_mode][C.STATS][C.LOGS] += games[game_mode][C.STATS][C.LOGS]
            games_all[game_mode][C.MATCHES][C.LOGS] += games[game_mode][C.MATCHES][
                C.LOGS
            ]
            for stat_name in MATCHES_STATS:
                stat_value = games[game_mode][C.MATCHES][C.STATS][stat_name]
                games_all[game_mode][C.MATCHES][C.STATS][stat_name] += stat_value

    return games_summary(games_all)


def games_summary(games: GamesStatus):
    # reset and summary all logs and stats
    games[C.ALL][C.STATS][C.LOGS] = []
    games[C.ALL][C.MATCHES][C.LOGS] = []
    games[C.ALL][C.MATCHES][C.STATS] = MATCHES_STATS.copy()
    for game_mode in SGM.modes():
        games[C.ALL][C.STATS][C.LOGS] += games[game_mode][C.STATS][C.LOGS]
        games[C.ALL][C.MATCHES][C.LOGS] += [
            log for log in games[game_mode][C.MATCHES][C.LOGS] if log['records']
        ]
        for stat_name, stat_value in games[game_mode][C.MATCHES][C.STATS].items():
            games[C.ALL][C.MATCHES][C.STATS][stat_name] += stat_value

    # sort matches and stats logs with limit
    for game_mode in SGM.modes(C.ALL, C.ALL):
        for data_type in (C.STATS, C.MATCHES):
            games[game_mode][data_type][C.LOGS] = sorted(
                games[game_mode][data_type][C.LOGS],
                key=lambda log: date_format(log[C.TIME], C.EPOCH),
                reverse=True,
            )[: settings.LOGS_GAMES_LIMIT]

    return games


def set_games(db: Session, uno: str, games: GamesStatus):
    games = games_summary(games)
    target_type = target_type_define(uno)
    redis_manage(f'{target_type}:{C.UNO}_{uno}', 'hset', {C.GAMES: games})

    if target_type != C.PLAYER:
        return

    player_get(db, uno, C.RAW, set_games.__name__).update({STT.players.games: games})
    db.commit()

    player_group = redis_manage(f'{target_type}:{C.UNO}_{uno}', 'hget', C.GROUP)

    if not player_group:
        return

    players: dict[str, TargetDataBasic] | None = redis_manage(
        f'{C.GROUP}:{C.UNO}_{player_group}', 'hget', C.PLAYERS
    )
    if players and uno in players:
        players[uno][C.GAMES] = games
        redis_manage(
            f'{C.GROUP}:{C.UNO}_{player_group}',
            'hset',
            {
                C.PLAYERS: players,
                C.GAMES: group_players_games(
                    [player[C.GAMES] for player in players.values()]
                ),
            },
        )
    else:
        in_logs(
            uno,
            f'{set_games.__name__} {C.GROUP} [{player_group}] {C.NOT_FOUND}',
            'cod_logs_error',
            players,
        )


def format_column(column: str):
    for letter in column:
        if letter.isupper():
            return f'"{column}"'
    return column


def format_stat_values(stats: dict):
    formated = {}

    for stat_name, stat_value in stats.items():
        if not stat_value:
            continue
        if isinstance(stat_value, dict):
            stat_value = format_stat_values(stat_value)
            if not stat_value:
                continue
        elif isinstance(stat_value, float):
            if stat_value == int(stat_value):
                stat_value = int(stat_value)
            else:
                if stat_name == C.ACCURACY:
                    stat_value = round(stat_value * 100, 2)
                else:
                    stat_value = round(stat_value, 2)

        formated[stat_name] = stat_value

    return correct_ratio(formated)


def correct_ratio(stats: dict[str, int | None]):
    if stats.get(C.KILLS) is not None and stats.get(C.DEATHS) is not None:
        stats[C.KDRATIO] = extract_ratio(stats[C.KILLS], stats[C.DEATHS])

    if stats.get('hits') is not None and stats.get('shots') is not None:
        stats[C.ACCURACY] = round(extract_ratio(stats['hits'], stats['shots']) * 100, 2)

    if stats.get('wins') is not None and stats.get('losses') is not None:
        stats['wlRatio'] = extract_ratio(stats['wins'], stats['losses'])

    if stats.get('scorePerGame') is not None:
        stats['scorePerGame'] = round(stats['scorePerGame'], 2)

    if stats.get('scorePerMinute') is not None:
        stats['scorePerMinute'] = round(stats['scorePerMinute'], 2)

    return stats


def extract_ratio(n: int, n1: int):
    return round(n / (n1 or 1), 2)


def game_stats_format(
    lifetime: GameStatsDataLifetime | GameStatsDataLifetimeCW | None,
    game: GameOnly,
) -> GameStats:
    data = {C.ALL: lifetime[C.ALL]['properties']}

    for weapon_name, weapon_value in lifetime['itemData'].items():
        if weapon_name == 'scorestreak':
            continue
        data[weapon_name] = {k: v['properties'] for k, v in weapon_value.items()}

    # delete duplicated stats
    for stat_name in ('gamesPlayed', 'winLossRatio', 'recordKillStreak'):
        if stat_name in data[C.ALL]:
            del data[C.ALL][stat_name]

    if game == C.CW:
        lifetime: GameStatsDataLifetimeCW = lifetime
        keys_to_rename = {
            C.KDRATIO: 'kdratio',
            'wlRatio': 'wlratio',
            'totalShots': 'shots',
            'longestStreak': 'longestKillstreak',
            'currentWinStreak': 'curWinStreak',
        }
        for name, rename in keys_to_rename.items():
            data[C.ALL][name] = data[C.ALL].pop(rename, 0)

        data['scorestreak'] = {
            k: v['properties']
            for k, v in lifetime['scorestreakData']['scorestreakData'].items()
        }
    else:
        lifetime: GameStatsDataLifetime = lifetime
        data['all_additional'] = lifetime['accoladeData']['properties']

        data[C.ALL]['longestStreak'] = data[C.ALL].pop('bestKillStreak', 0)

        data['scorestreak'] = {}
        for k, v in lifetime['scorestreakData']['lethalScorestreakData'].items():
            data['scorestreak'][k] = v['properties']
        for k, v in lifetime['scorestreakData']['supportScorestreakData'].items():
            data['scorestreak'][k] = v['properties']

    if 'attachmentData' in lifetime:
        data['attachment'] = {}
        for attachment_name, attachment_stats in lifetime['attachmentData'].items():
            data['attachment'][attachment_name] = {}
            for stat_name, stat_value in attachment_stats['properties'].items():
                if stat_name == 'headShots':
                    stat_name = C.HEADSHOTS
                data['attachment'][attachment_name][stat_name] = stat_value

    for stats_name, stats_value in data.items():
        if stats_name in (C.ALL, 'all_additional'):
            continue
        summary = {}
        for weapon_value in stats_value.values():
            # summary weapon stats
            for stat_name, stat_value in weapon_value.items():
                summary[stat_name] = summary.get(stat_name, 0) + stat_value

        stats_value[C.ALL] = correct_ratio(summary)

    return format_stat_values(data)


def is_none_value(value):
    if not value:
        return True
    if value in ('none', 'nones', 'null', '0'):
        return True
    return False


def group_players(uno: str, players: list[cod_players]):
    chart, most_play_with, loadout = redis_manage(
        f'{C.GROUP}:{C.UNO}_{uno}', 'hmget', (C.CHART, C.MOST_PLAY_WITH, C.LOADOUT)
    )
    group: GroupData = {
        C.UNO: uno,
        C.USERNAME: [],
        C.CLANTAG: [],
        C.GAMES: group_players_games([player.games for player in players]),
        C.GAMES_STATS: {},
        'games_stats_best': {},
        C.CHART: chart,
        C.MOST_PLAY_WITH: most_play_with,
        C.LOADOUT: loadout,
        C.PLAYERS: {},
    }

    for player in players:
        group[C.USERNAME] += player.username
        group[C.CLANTAG] += player.clantag
        group[C.PLAYERS][player.uno] = {
            C.UNO: player.uno,
            C.USERNAME: player.username,
            C.CLANTAG: player.clantag,
            C.GAMES: player.games,
        }

    group[C.USERNAME] = list(set(group[C.USERNAME]))
    group[C.CLANTAG] = list(set(group[C.CLANTAG]))

    for game in GAMES_LIST:
        games_stats = {}
        games_stats_best = {}

        for player in players:
            player_stats = player.games_stats.get(game)
            if not player_stats:
                continue

            for stats_name, stats_values in player_stats.items():
                if stats_name not in games_stats:
                    games_stats[stats_name] = {}
                    games_stats_best[stats_name] = {}

                # games_stats[stats_name] = games_stats.get(stats_name, {})
                if stats_name in (C.ALL, 'all_additional'):
                    for stat_name, value in stats_values.items():
                        stat_current = games_stats[stats_name].get(stat_name, 0)
                        stat_best = games_stats_best[stats_name].get(
                            stat_name, {C.VALUE: value, C.UNO: player.uno}
                        )

                        if is_best_record(stat_name):
                            # replace if better than previous
                            stat_current = max(stat_current, value)
                        else:
                            # summary stat value
                            stat_current += value

                        if value > stat_best[C.VALUE]:
                            stat_best[C.UNO] = player.uno
                            stat_best[C.VALUE] = value

                        games_stats[stats_name][stat_name] = stat_current
                        if stat_best[C.VALUE]:
                            games_stats_best[stats_name][stat_name] = stat_best

                    games_stats[stats_name] = correct_ratio(games_stats[stats_name])
                    continue

                for weapon_name, weapon_value in stats_values.items():
                    stat_current = games_stats[stats_name].get(weapon_name, {})
                    stat_best = games_stats_best[stats_name].get(weapon_name, {})

                    for stat_name, value in weapon_value.items():
                        stat_current[stat_name] = stat_current.get(stat_name, 0) + value
                        if value > stat_best.get(stat_name, {}).get(C.VALUE, 0):
                            stat_best[stat_name] = {
                                C.UNO: player.uno,
                                C.VALUE: value,
                            }

                    games_stats[stats_name][weapon_name] = correct_ratio(stat_current)
                    games_stats_best[stats_name][weapon_name] = stat_best

        group[C.GAMES_STATS][game] = games_stats or None
        group['games_stats_best'][game] = games_stats_best or None

    return group


def tracker_stats_get(db: Session):
    stats: TrackerStats = config_get(db, C.STATS, C.TRACKER).first()

    if (
        not stats.data
        or not stats.time
        or not seconds_wait_expire(stats.time, settings.STATS_INTERVAL_WEEKS)
    ):
        stats = tracker_stats_update(db)
    else:
        stats = {C.DATA: stats.data, C.TIME: date_format(stats.time, C.ISO)}

    return stats


def tracker_stats_summary(db: Session, group: GroupData):
    # TODO integrate to tracker_stats_update
    data: TrackerStatsValue = tracker_stats_get(db)[C.DATA]
    group[C.MOST_PLAY_WITH] = data[C.MOST_PLAY_WITH]

    # reset matches stats for tracker
    for game_mode in SGM.modes(C.ALL, C.ALL):
        group[C.GAMES][game_mode][C.MATCHES][C.STATS] = MATCHES_STATS.copy()

    mw_mp = group[C.GAMES][C.MW_MP][C.MATCHES][C.STATS]
    mw_wz = group[C.GAMES][C.MW_WZ][C.MATCHES][C.STATS]

    # set matches stats
    for game_mode in SGM.modes(C.ALL, C.ALL):
        rows = data[C.MATCHES][game_mode][C.ROWS]
        group[C.GAMES][game_mode][C.MATCHES][C.STATS][C.MATCHES] = rows

    # set fullmatches stats
    mw_mp[C.FULLMATCHES] = (
        data['fullmatches_main'][C.MW_MP][C.ROWS]
        + data['fullmatches_basic'][C.MW_MP][C.ROWS]
    )
    mw_wz[C.FULLMATCHES] = sum(
        [
            stat[C.ROWS]
            for stat in (
                list(data['fullmatches_main'][C.MW_WZ].values())
                + list(data['fullmatches_basic'][C.MW_WZ].values())
            )
        ]
    )
    group[C.GAMES][C.ALL][C.MATCHES][C.STATS][C.FULLMATCHES] = (
        mw_mp[C.FULLMATCHES] + mw_wz[C.FULLMATCHES]
    )

    return group


def players_cache_update(db: Session):
    players = db.query(STT.players).all()
    players_with_group = [player for player in players if player.group]

    redis_manage(f'{C.PLAYER}:*', C.DELETE)
    for player in players:
        player_data: PlayerData = {
            C.UNO: player.uno,
            C.USERNAME: player.username,
            C.CLANTAG: player.clantag,
            C.GAMES: player.games,
            C.GAMES_STATS: player.games_stats,
            C.CHART: player.chart,
            C.MOST_PLAY_WITH: player.most_play_with,
            C.LOADOUT: player.loadout,
            C.GROUP: player.group,
        }
        redis_manage(f'{C.PLAYER}:{C.UNO}_{player.uno}', 'hset', player_data)
        redis_manage(f'{C.PLAYER}:{C.ID}_{player.id}', 'set', player.uno)
        redis_manage(f'{C.PLAYER}:{C.USERNAME}_{player.username[0]}', 'set', player.uno)
        if player.acti:
            redis_manage(f'{C.PLAYER}:{C.ACTI}_{player.acti}', 'set', player.uno)
        if player.battle:
            redis_manage(f'{C.PLAYER}:{C.BATTLE}_{player.battle}', 'set', player.uno)

    # summared players by tracker and all groups
    groups: list[GroupData] = [
        tracker_stats_summary(db, group_players(C.TRACKER, players)),
        group_players(C.ALL, players_with_group),
    ]

    for uno in {player.group for player in players_with_group}:
        players_in_group = [
            player for player in players_with_group if player.group == uno
        ]
        groups.append(group_players(uno, players_in_group))

    redis_manage(f'{C.GROUP}:*', C.DELETE)
    for group in groups:
        redis_manage(f'{C.GROUP}:{C.UNO}_{group[C.UNO]}', 'hset', group)


def add_to_task_queues(
    uno: str, game_mode: GameMode, data_type: DataType
) -> TaskStatus:
    name = f'{uno} {game_mode} {data_type}'
    task_queues = redis_manage(C.TASK_QUEUES, 'lrange')

    if not task_queues:
        task_status = STaskStatus.STARTED
    elif task_queues[0][C.NAME] == name and task_queues[0][C.STATUS] == STask.RUNNING:
        task_status = STaskStatus.ALREADY_RUNNING
    elif name in [task[C.NAME] for task in task_queues]:
        task_status = STaskStatus.IN_QUEUES
    else:
        task_status = STaskStatus.ADDED

    if task_status in (STaskStatus.STARTED, STaskStatus.ADDED):
        task: Task = {
            C.ID: 0,
            C.NAME: name,
            C.UNO: uno,
            C.GAME_MODE: game_mode,
            C.DATA_TYPE: data_type,
            C.STATUS: STask.PENDING,
            C.DATA: {},
            C.TIME: now(C.ISO),
            'time_started': None,
            'time_end': None,
        }

        caller_frame = inspect.currentframe().f_back
        task[C.DATA] |= {'caller_func': caller_frame.f_code.co_name} | {
            arg: str(value)
            for arg, value in caller_frame.f_locals.items()
            if isinstance(value, (str, int))
        }

        if player := redis_manage(f'{C.PLAYER}:{C.UNO}_{uno}', 'hgetall'):
            task[C.DATA][C.USERNAME] = player[C.USERNAME][0]
            task[C.DATA][C.GROUP] = player[C.GROUP]
            task[C.DATA][f'{C.PLAYER}_{C.STATUS}'] = player[C.GAMES][C.ALL][C.STATUS]
            task[C.DATA][f'{C.GAME}_{C.STATUS}'] = player[C.GAMES][game_mode][C.STATUS]

        redis_manage(C.TASK_QUEUES, 'rpush', [task])

    return task_status


def in_logs_queues(db: Session, task: Task):
    task['time_end'] = now()
    for time_key in (C.TIME, 'time_started'):
        if task[time_key]:
            task[time_key] = date_format(task[time_key])

    del task[C.ID]
    table = LOGS_TABLES['cod_logs_task_queues']
    new_log = table()
    new_log.__dict__.update(task)
    db.add(new_log)
    db.commit()


def clear_task_queues(db: Session):
    task_queues: list[Task] = redis_manage(C.TASK_QUEUES, 'lrange')
    if not task_queues:
        return

    saved_tasks: list[Task] = []
    for task in task_queues:
        if task[C.STATUS] in (STask.RUNNING, STask.PAUSE):
            saved_tasks.append(task)
        else:
            task[C.STATUS] = STask.DELETED
            task[C.DATA][C.SOURCE] = clear_task_queues.__name__
            in_logs_queues(db, task)

    redis_manage(C.TASK_QUEUES, 'ltrim')

    if saved_tasks:
        redis_manage(C.TASK_QUEUES, 'rpush', saved_tasks)


def get_played_stat(db: Session, uno: int | str, game_mode: GameMode):
    game = SGM.desctruct_game_mode(game_mode)[0]
    game_stats = player_get(
        db, uno, C.GAMES_STATS, f'{get_played_stat.__name__} {game_mode=}'
    ).get(game)
    if not game_stats:
        return 0
    played = game_stats[C.ALL]['totalGamesPlayed']
    return int(played)


def validate_group_name(group):
    error = None

    FORBIDEN_NAMES: list[str] = (
        (C.TRACKER,) + GameMode.__args__ + Game.__args__ + Mode.__args__
    )

    if is_number(group):
        error = f'{C.GROUP} {C.NAME} can\'t be a number [{group}]'
    elif not group or isinstance(group, str) is False:
        error = f'{C.GROUP} {C.NAME} {C.NOT_VALID}'
    elif len(group) < settings.GROUP_NAME_LENGTH_REQUIRED:
        error = f'{C.GROUP} {C.NAME} {group} too short'
    elif len(group) > settings.GROUP_NAME_LENGTH_LIMIT:
        error = f'{C.GROUP} {C.NAME} {group} too long'
    elif group.lower() in FORBIDEN_NAMES:
        error = f'{C.GROUP} {C.NAME} can\'t be [{group}]'

    return error


def player_format_search(player: Player):
    player[C.ID] = 0
    player[C.GAMES_STATS] = {}
    player[C.DATA] = None

    return player


def make_break(
    target: str,
    game_mode: GameMode,
    source: str,
    minutes: int | None = None,
):
    if minutes is None:
        message = f'fetch {C.DATA} {C.DISABLED} {source=}'
    else:
        message = f'break {minutes=} {source=}'

    in_logs(target, f'{game_mode} {message}', 'cod_logs')

    if minutes == 0:
        return

    in_logs_cod_logs_cache(target, game_mode, message)

    if minutes is None:
        redis_manage(C.STATUS, 'set', C.INACTIVE)
        return

    redis_manage(C.STATUS, 'set', 'break')

    task: Task | None = redis_manage(C.TASK_QUEUES, 'lindex')
    if task is None or task[C.STATUS] != STask.RUNNING:
        time.sleep(get_delay(minutes, 'minutes', True))
        redis_manage(C.STATUS, 'set', C.ACTIVE)
        return

    task[C.STATUS] = STask.PAUSE
    redis_manage(C.TASK_QUEUES, 'lset', task)

    time.sleep(get_delay(minutes, 'minutes', True))
    redis_manage(C.STATUS, 'set', C.ACTIVE)

    task[C.STATUS] = STask.RUNNING
    redis_manage(C.TASK_QUEUES, 'lset', task)


@log_time_wrap
def fullmatches_basic_load_from_csv(
    db: Session,
    game_mode: GameMode,
    year: YearWzTable,
    path: str,
):
    table_main = STT.get_table(game_mode, C.MAIN, year).table
    table_basic = STT.get_table(game_mode, C.BASIC, year).table

    already_exist = (
        db.query(table_basic.matchID.distinct(), table_basic.matchID)
        .union(db.query(table_main.matchID.distinct(), table_main.matchID))
        .all()
    )
    already_exist = tuple(match.matchID for match in already_exist)

    print(
        f'collected exist {C.MATCHES} [{len(already_exist)}] from',
        f'table {C.MAIN} {table_main.__tablename__}',
        f'table {C.BASIC} {table_basic.__tablename__}',
        sep='\n',
    )

    STEP = 10_000
    matches_not_saved = 0
    current_line = 0
    current_step = 0

    pure_path = f'{path}/cod_{C.FULLMATCHES}_{game_mode}_{year}.csv'
    with open(pure_path, 'r', encoding='utf8') as file:
        matches = csv.DictReader(file)

        for current_line, match in enumerate(matches):
            if current_line >= current_step + STEP:
                db.commit()
                current_step = current_line
                print(f'{current_step=} saved {current_step - matches_not_saved}')

            if match[C.MATCHID] in already_exist:
                continue

            del match[C.ID]
            match = {k: v for k, v in match.items() if v}
            match_row = table_basic()
            match_row.__dict__.update(match)
            db.add(match_row)

            # try:
            #     db.commit()
            # except Exception as e:
            #     matches_not_saved += 1
            #     in_logs(
            #         fullmatches_basic_load_from_csv.__name__,
            #         f'{type(e).__name__} {current_line}',
            #         'cod_logs_error',
            #         {
            #             'trace': traceback.format_exc(),
            #             C.MATCH: match,
            #         },
            #     )


def is_best_record(stat_name: str):
    return (
        stat_name in (C.ACCURACY, 'longestStreak', 'currentWinStreak')
        or 'best' in stat_name
        or 'record' in stat_name
        or 'most' in stat_name
    )


def target_data_stats_save(
    db: Session,
    uno: str,
    name: Literal['chart', 'most_play_with', 'loadout'],
    value: Chart | MostPlayWith | Loadout,
):
    value[C.TIME] = now(C.ISO)
    target_type = target_type_define(uno)

    if target_type == C.PLAYER:
        player_get(db, uno, C.RAW, f'{target_data_stats_save.__name__} {name=}').update(
            {STT.players.__dict__[name]: value}
        )
        db.commit()

    redis_manage(f'{target_type}:{C.UNO}_{uno}', 'hset', {name: value})


def target_unos_get(target_type: TargetType | Literal['all']):
    targets_uid: list[str] = []

    if target_type == C.ALL:
        target_type += redis_manage(f'{C.PLAYER}:{C.UNO}_*', 'keys')
        target_type += redis_manage(f'{C.GROUP}:{C.UNO}_*', 'keys')
    else:
        targets_uid = redis_manage(f'{target_type}:{C.UNO}_*', 'keys')

    target_unos = [uid.split(f'{C.UNO}_', 2)[1] for uid in targets_uid]
    return target_unos
