import datetime
import traceback
import time
import os

import base64
import copy
import shutil
from pathlib import Path
from io import BytesIO

from collections import Counter, defaultdict
from typing import Literal
from PIL import Image
import simplejson as json

from fastapi import WebSocket, status
from starlette.requests import Request
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import ValidationError

from core.config import settings

from apps.base.crud.store_tables import SBT
from apps.base.crud.utils_data_init import LOGS_TABLES
from apps.base.crud.main import logs_tabs_get
from apps.base.crud.utils import (
    date_format,
    get_base_stats,
    get_last_id,
    redis_manage,
    now,
    time_taken_get,
    to_dict,
    in_logs,
    json_error,
    get_status,
    log_time_wrap,
    in_logs_cod_logs_cache,
    set_table_sequence,
    update_base_stats,
    seconds_wait_expire,
    get_message_response,
    manage_monitor,
    users_cache_set,
)
from apps.base.schemas.main import (
    C,
    SMessage,
    STask,
    STaskStatus,
    EditTarget,
    Message,
    UsersPage,
    RedisTargetStatus,
)

from apps.tracker.crud.store_tables import STT
from apps.tracker.crud.store_game_modes import SGM
from apps.tracker.crud.match_formatter import MF
from apps.tracker.crud.utils_data_init import (
    GAMES_LIST,
    player_init,
)
from apps.tracker.crud.get_game_data import GameData
from apps.tracker.schemas.main import (
    SC,
    GameModeMw,
    MatchPlayer,
    PlayerMatchesDeleteResponse,
    SGame,
    MatchBody,
    MatchesStats,
    PlayersSearch,
    Router,
    StatsRouter,
    UpdateRouter,
    MatchesResponse,
    MatchData,
    PlayerMatchesHistoryPars,
    GamesStatus,
    Error,
    GameStats,
    SearchResp,
    TargetDataBasic,
    TargetGameMode,
    PlayerSearch,
    ImageData,
    EditPlayerResponse,
    ImageUploadSubmit,
    PlayerAdd,
    PlayerData,
    ResetResponse,
    TableGameData,
    AllPlayers,
    MatchesData,
    TeamData,
    UpdateResponse,
    FullmatchData,
    LabelsItem,
    ClearFullmatchesDoublesResponse,
    ClearFullmatchDoublesBody,
    Task,
    Panel,
    ImageGameMaps,
    ImageGameMap,
    ImageUpload,
    ImageUploadFiles,
    LogsSearch,
    LogsSearchData,
    GroupData,
    LoadoutStatsData,
    PlayerBasic,
    Player,
    MatchStatsPlayer,
    GameModeOnly,
    ResetType,
    DataType,
    PlayerStatus,
    GameDataSlugs,
    GameMode,
    Game,
    LabelType,
    PlatformOnly,
    Year,
    YearWzTable,
    DataTypeOnly,
    UpdateRouterDataType,
    SPlayerParsed,
    MatchResultMp,
)

from apps.tracker.crud.utils import (
    correct_ratio,
    player_get,
    game_stats_format,
    target_unos_get,
    tracker_stats_get,
    format_column,
    is_none_value,
    set_games,
    make_break,
    send,
    in_logs_game_status,
    tracker_stats_update,
    clear_task_queues,
    get_played_stat,
    players_cache_update,
    add_to_task_queues,
    in_logs_queues,
    target_type_define,
    validate_group_name,
    player_format_search,
    is_best_record,
    target_data_stats_save,
)


def test(db: Session, target: str):  # pylint: disable=unused-argument
    return loadout_update(db)


def panel_get(db: Session) -> Panel:
    groups = target_unos_get(C.GROUP)
    pages: dict[str, int | None] = {
        C.MAIN: None,
        C.PLAYERS: db.query(STT.players).count(),
        C.GROUPS: len(groups),
        C.USERS: db.query(SBT.users).count(),
        C.NOTES: db.query(SBT.notes).filter(SBT.notes.completed == False).count(),
        C.CONFIGS: db.query(SBT.configs).count(),
        C.LOGS: logs_tabs_get(db)[C.ALL],
        C.ROLES: db.query(SBT.users_role).count(),
        C.TRANSLATE: (
            db.query(SBT.translate).count() + db.query(SBT.translate_stats).count()
        ),
        'images': images_count_get(),
        'labels': sum(labels_count_get(db).values()),
    }

    admin_role = db.query(SBT.users_role).filter(SBT.users_role.name == C.ADMIN).first()
    panel_page: UsersPage = [
        page for page in admin_role.pages if page[C.NAME] == 'panel'
    ][0]
    for sub_page in panel_page['sub_pages']:
        if sub_page not in pages:
            pages[sub_page] = None

    monitor_time = manage_monitor(C.TIME)

    return {
        'statuses': {
            C.STATUS: redis_manage(C.STATUS),
            C.MONITOR: bool(monitor_time),
            C.AUTO_UPDATE: get_status(C.AUTO_UPDATE),
            'store_data': get_status('store_data'),
        },
        C.PAGES: pages,
        'resets': ResetType.__args__,
        C.TIME: monitor_time,
        C.TASK_QUEUES: redis_manage(C.TASK_QUEUES, 'lrange'),
        C.UPDATE_PLAYERS: redis_manage(C.UPDATE_PLAYERS, 'lrange'),
        'base_stats': get_base_stats(db),
        'tracker_stats': tracker_stats_get(db),
        C.GROUPS: groups,
    }


def reset(db: Session, reset_type: ResetType) -> ResetResponse | Error:
    start = time.perf_counter()
    # Map reset type to corresponding function
    reset_functions = {
        C.USERS: users_cache_set,
        C.PLAYERS: players_cache_update,
        C.LOADOUT: loadout_update,
        C.CHART: update_chart,
        C.TASK_QUEUES: clear_task_queues,
        'matches_stats': update_matches_stats,
        'base_stats': update_base_stats,
        'tracker_stats': tracker_stats_update,
        'clear_players_match_doubles': clear_players_match_doubles,
    }

    if reset_type in reset_functions:
        reset_functions[reset_type](db)
    elif reset_type in RedisTargetStatus.__args__:
        new_status = int(not get_status(reset_type))
        redis_manage(reset_type, 'set', new_status)
    elif reset_type == C.UPDATE_PLAYERS:
        redis_manage(reset_type, 'ltrim')
    elif reset_type == C.STATUS:
        redis_manage(
            reset_type,
            'set',
            C.INACTIVE if redis_manage(C.STATUS) == C.ACTIVE else C.ACTIVE,
        )
    elif reset_type == C.MATCHES:
        redis_manage(f'{reset_type}:*', C.DELETE)
    elif reset_type == C.MONITOR:
        current_status = manage_monitor(C.STATUS)
        action = 'stop' if current_status else 'start'
        manage_monitor(action)
        # wait action done and monitor status will change
        INTERVAL = 2
        SECONDS_WAIT = 30
        seconds_passed = 0
        while manage_monitor(C.STATUS) is current_status:
            time.sleep(INTERVAL)
            seconds_passed += INTERVAL
            if (seconds_passed % 10) == 0:
                manage_monitor(action)
            if seconds_passed > SECONDS_WAIT:
                return json_error(
                    status.HTTP_408_REQUEST_TIMEOUT,
                    f'{C.LOGS} {C.TIME} waiting {C.DISABLED}',
                )
        reset_type += f' {seconds_passed=}'
    elif reset_type in ('reboot', 'shutdown'):
        os.system(reset_type)
    else:
        message = f'[{reset_type}] {C.NOT_FOUND}'
        in_logs('reset', message, 'logs_error')
        return json_error(status.HTTP_404_NOT_FOUND, message)

    in_logs('reset', reset_type, C.LOGS)

    return {C.TIME_TAKEN: time_taken_get(start)}


def players_get(db: Session) -> AllPlayers:
    players = list(map(to_dict, db.query(*STT.players_basic).all()))
    players.sort(key=lambda x: x[C.ID])
    return {C.PLAYERS: players}


def player_add(db: Session, body: PlayerAdd):
    if error := validate_group_name(body.group):
        return json_error(status.HTTP_422_UNPROCESSABLE_ENTITY, error)

    player: PlayerBasic | None = player_get(
        db,
        body.uno,
        C.BASIC,
        f'{player_add.__name__} {body.group}',
    )

    if player is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.PLAYER} [{body.uno}] {C.NOT_FOUND}'
        )

    if player[C.GROUP]:
        message = f'[{player[C.USERNAME][0]}] {C.ALREADY_EXIST}\
        in {C.GROUP} [{player[C.GROUP]}]'
        in_logs(player[C.UNO], message, 'cod_logs_player')
        return json_error(status.HTTP_302_FOUND, message)

    player[C.GROUP] = body.group

    player_get(
        db,
        player[C.UNO],
        C.RAW,
        f'set {C.GROUP} [{player[C.GROUP]}]',
    ).update({STT.players.group: player[C.GROUP]})
    db.commit()

    players_cache_update(db)
    player_matches_history_pars(player[C.UNO])

    res: Message = {
        C.MESSAGE: f'{C.PLAYER} [{player[C.USERNAME][0]}] successfully added'
    }

    return res


def player_pre_check(db: Session, body: PlayerSearch) -> SearchResp:
    platform, target, uno = body.platform, body.target, body.uno

    if platform in SC.PLATFORMS:
        if platform == C.UNO:
            player = player_get(db, target, C.BASIC, player_pre_check.__name__)
        elif _uno := redis_manage(f'{C.PLAYER}:{platform}_{target}', 'get'):
            player = player_get(db, _uno, C.BASIC, player_pre_check.__name__)
        else:
            player = None

        if player:
            if player[C.GROUP]:
                return {
                    C.MESSAGE: f'[{player[C.USERNAME][0]}] {C.ALREADY_EXIST}',
                    C.STATUS: SMessage.MESSAGE,
                    C.RESULT: player[C.UNO],
                    C.TIME: now(C.ISO),
                }
            return {
                C.MESSAGE: 'found',
                C.STATUS: SMessage.SUCCESS,
                C.RESULT: player_format_search(player),
                C.TIME: now(C.ISO),
            }

        player = player_find_tag_data(target, platform)
        player_status = SMessage.SUCCESS if player[C.USERNAME] else SMessage.ERROR

        if player_status:
            # check by uno tag if player already registered
            player_query = player_get(
                db,
                player[C.UNO],
                C.RAW,
                f'{player_pre_check.__name__} {player_status=}',
            )
            if found := player_query.first():
                # save new player tag for player in base
                player_query.update({STT.players.__dict__[platform]: target})
                db.commit()
                return {
                    C.MESSAGE: f'[{found.username[0]}] {C.ALREADY_EXIST}',
                    C.STATUS: SMessage.MESSAGE,
                    C.RESULT: found.uno,
                    C.TIME: now(C.ISO),
                }

            if not player[C.ACTI]:
                players: list[Player] = list(
                    players_search(
                        player[C.USERNAME][0], player[C.UNO], (C.ACTI,)
                    ).players.values()
                )
                if players:
                    player[C.ACTI] = players[0][C.ACTI]

            save_player = STT.players()
            save_player.__dict__.update(
                {k: v for k, v in player.items() if v is not None}
            )
            save_player.id = get_last_id(db, STT.players) + 1
            db.add(save_player)
            db.commit()

        return {
            C.MESSAGE: 'found',
            C.STATUS: player_status,
            C.RESULT: player_format_search(player),
            C.TIME: now(C.ISO),
        }

    if uno and (player := player_get(db, uno, C.BASIC, player_pre_check.__name__)):
        return {
            C.MESSAGE: 'found',
            C.STATUS: SMessage.MESSAGE,
            C.RESULT: player_format_search(player),
            C.TIME: now(C.ISO),
        }

    # Check if Player been searched before.
    table_search = LOGS_TABLES['cod_logs_search']
    search: LogsSearch = (
        db.query(table_search).filter(table_search.target.ilike(target)).first()
    )
    if not search:
        return {
            C.MESSAGE: C.NOT_FOUND,
            C.STATUS: SMessage.ERROR,
            C.RESULT: None,
            C.TIME: now(C.ISO),
        }

    if not search.data:
        return {
            C.MESSAGE: f'[{target}] [{uno}] {C.NOT_FOUND} [{date_format(search.time, C.DATETIME)}]',
            C.STATUS: SMessage.ERROR,
            C.RESULT: None,
            C.TIME: now(C.ISO),
        }

    responses: list[SearchResp] = []

    for log_player in search.data:
        if log_player[C.USERNAME]:
            player: PlayerBasic | None = player_get(
                db,
                log_player[C.UNO],
                C.BASIC,
                f'{player_pre_check.__name__} {log_player=}',
            )
            if player is None:
                responses.append(
                    {
                        C.MESSAGE: f'[{target}] [{log_player[C.UNO]}] \
                        [{log_player[C.USERNAME][0]}] \
                        was lost from database',
                        C.STATUS: SMessage.ALERT,
                        C.RESULT: None,
                        C.TIME: now(C.ISO),
                    }
                )
            else:
                responses.append(
                    {
                        C.MESSAGE: 'found',
                        C.STATUS: SMessage.MESSAGE,
                        C.RESULT: player_format_search(player),
                        C.TIME: now(C.ISO),
                    }
                )
        else:
            responses.append(
                {
                    C.MESSAGE: 'found',
                    C.STATUS: SMessage.MESSAGE,
                    C.RESULT: player_format_search(player_init(log_player)),
                    C.TIME: now(C.ISO),
                }
            )

    if responses:
        return {
            C.MESSAGE: C.RESULT,
            C.STATUS: SMessage.MESSAGE,
            C.RESULT: responses,
            C.TIME: now(C.ISO),
        }

    if (tracker_status := redis_manage(C.STATUS)) != C.ACTIVE:
        return {
            C.MESSAGE: tracker_status,
            C.STATUS: SMessage.ALERT,
            C.RESULT: None,
            C.TIME: now(C.ISO),
        }

    return {
        C.MESSAGE: C.NOT_FOUND,
        C.STATUS: SMessage.ERROR,
        C.RESULT: None,
        C.TIME: now(C.ISO),
    }


async def player_search(db: Session, ws: WebSocket):
    await ws.accept()
    search_body: PlayerSearch = await ws.receive_json()
    target: str = search_body[C.TARGET]
    uno: str | None = search_body[C.UNO]

    search = await players_search_ws(ws, target, uno, (C.ACTI, C.BATTLE))
    players: list[Player] = list(search.players.values())
    players.sort(key=lambda x: x[C.USERNAME])

    search_data: list[LogsSearchData] = []

    for player in players:
        data: LogsSearchData = {
            C.ACTI: player[C.ACTI],
            C.BATTLE: player[C.BATTLE],
            C.UNO: player[C.UNO],
            C.USERNAME: player[C.USERNAME],
        }
        search_data.append(data)

        if not data[C.USERNAME]:
            continue

        uno_registered = (
            db.query(STT.players).filter(STT.players.uno == player[C.UNO]).count()
        )
        if uno_registered:
            continue

        save_player = STT.players()
        save_player.__dict__.update(player)
        save_player.id = get_last_id(db, STT.players) + 1
        db.add(save_player)

    table_search = LOGS_TABLES['cod_logs_search']
    db.add(table_search(target=target, uno=uno, data=search_data))

    db.commit()

    if search.checked:
        message = f'checked {search.checked} {C.PLAYERS} saved {len(players)}'
    else:
        message = f'[{target}] {C.NOT_FOUND}'

    await send(ws, message, SMessage.MESSAGE)
    await ws.close()


def player_matches_history_pars(uno: str) -> PlayerMatchesHistoryPars | Error:
    username, games = redis_manage(
        f'{C.PLAYER}:{C.UNO}_{uno}', 'hmget', (C.USERNAME, C.GAMES)
    )
    if not username:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{uno}] {C.NOT_FOUND}')
    if games[C.ALL][C.STATUS] > SPlayerParsed.NONE:
        return json_error(
            status.HTTP_302_FOUND,
            f'{C.MATCHES} [{username[0]}] already parsed',
        )

    task_queues_statuses = []
    for game_mode in SGM.modes():
        if games[game_mode][C.STATUS] != 1:
            continue
        task_queues_status = add_to_task_queues(uno, game_mode, C.MATCHES_HISTORY)
        in_logs_cod_logs_cache(username[0], game_mode, task_queues_status)
        task_queues_statuses.append(f'{game_mode} {task_queues_status}')

    return {
        C.MESSAGE: f'pars {C.MATCHES} [{username[0]}] started',
        C.DATA: task_queues_statuses,
    }


def player_find_tag_data(player_tag: str, platform: PlatformOnly) -> Player:
    player = player_init({platform: player_tag})

    for game_mode in SGM.modes():
        slugs = (player_tag, game_mode, C.MATCHES, platform, 0)
        data = GameData.get(slugs, 0.5, True)
        if not data or C.MATCHES not in data:
            continue

        player[C.GAMES][game_mode][C.STATUS] = SGame.ENABLED

        for match in data[C.MATCHES]:
            for meta in (C.USERNAME, C.CLANTAG):
                player_meta = match[C.PLAYER].get(meta)
                if player_meta and player_meta not in player[meta]:
                    player[meta].append(player_meta)

            if not player[C.UNO] and match[C.PLAYER].get(C.UNO):
                player[C.UNO] = match[C.PLAYER].get(C.UNO)

    if not player[C.USERNAME]:
        return player

    for game in GAMES_LIST:
        if game == C.ALL:
            continue
        game_mode: GameModeOnly = f'{game}_{C.MP}'
        if player[C.GAMES][game_mode][C.STATUS] == SGame.NOT_ENABLED:
            continue
        slugs = (player_tag, game_mode, C.STATS, platform, 0)
        data = GameData.get(slugs, 0.5, True)
        if data is None or data.get('title') is None:
            continue
        player[C.GAMES_STATS][game] = game_stats_format(data['lifetime'], game)

        played = player[C.GAMES_STATS][game][C.ALL]['totalGamesPlayed']
        player[C.GAMES][game_mode][C.MATCHES][C.STATS][C.PLAYED] = played
        player[C.GAMES][C.ALL][C.MATCHES][C.STATS][C.PLAYED] += played

    player[C.GAMES_STATS] = stats_add_summary_all_modes(player[C.GAMES_STATS])

    return player


def players_search(
    username: str,
    uno: str | None,
    platforms: tuple[PlatformOnly],
):
    res = PlayersSearch(players={}, checked=0)

    for platform in platforms:
        is_acti_search = platform == C.ACTI and uno is None

        slugs = (username, C.MW_WZ, C.SEARCH, platform, 0)
        found_players = GameData.get(slugs, 0.5)

        if isinstance(found_players, list) is False:
            continue

        for found_player in found_players:
            if is_acti_search and found_player['accountId'] != uno:
                continue
            if not (player_tag := found_player.get(C.USERNAME)):
                continue

            player = player_find_tag_data(player_tag, platform)
            player_status = SMessage.SUCCESS if player[C.USERNAME] else SMessage.ERROR
            res.checked += 1

            if platform == C.ACTI and not player[C.UNO]:
                player[C.UNO] = found_player['accountId']

            if uno is None or player[C.UNO] == uno:
                if player[C.UNO] in res.players:
                    res.players[player[C.UNO]][platform] = player_tag
                    player = res.players[player[C.UNO]]
                    res.checked -= 1
                else:
                    res.players[player[C.UNO]] = player

            if (
                player[C.UNO] == uno and player_status == SMessage.ERROR
            ) or is_acti_search:
                break

    return res


async def players_search_ws(
    ws: WebSocket,
    username: str,
    uno: str | None,
    platforms: tuple[PlatformOnly],
):
    res = PlayersSearch(players={}, checked=0)

    for platform in platforms:
        is_acti_search = platform == C.ACTI and uno is None

        slugs = (username, C.MW_WZ, C.SEARCH, platform, 0)
        found_players = GameData.get(slugs, 0.5)

        if isinstance(found_players, list) is False:
            continue

        for found_player in found_players:
            if is_acti_search and found_player['accountId'] != uno:
                continue
            if not (player_tag := found_player.get(C.USERNAME)):
                continue

            player = player_find_tag_data(player_tag, platform)
            player_status = SMessage.SUCCESS if player[C.USERNAME] else SMessage.ERROR
            res.checked += 1

            if platform == C.ACTI and not player[C.UNO]:
                player[C.UNO] = found_player['accountId']

            if uno is None or player[C.UNO] == uno:
                if player[C.UNO] in res.players:
                    res.players[player[C.UNO]][platform] = player_tag
                    player = res.players[player[C.UNO]]
                    res.checked -= 1
                else:
                    res.players[player[C.UNO]] = player

            await send(ws, C.RESULT, player_status, player_format_search(player))

            if (
                player[C.UNO] == uno and player_status == SMessage.ERROR
            ) or is_acti_search:
                await send(
                    ws, f'{platform} {player_tag} [{uno}] found', SMessage.SUCCESS
                )
                break

    return res


def player_add_game_mode(db: Session, body: TargetGameMode) -> Error | Message:
    uno, game_mode = body.target, body.game_mode

    player: PlayerBasic | None = player_get(
        db,
        uno,
        C.BASIC,
        f'{player_add_game_mode.__name__} {game_mode=}',
    )

    if player is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'{C.PLAYER} {C.NOT_FOUND}')

    info = f'{game_mode} [{player[C.USERNAME][0]}]'

    if player[C.GAMES][game_mode][C.STATUS] != 0:
        return json_error(status.HTTP_302_FOUND, f'{info} already {C.ENABLED}')

    data = get_data_from_platforms(player, game_mode, C.MATCHES)
    if not data[C.DATA]:
        return json_error(status.HTTP_405_METHOD_NOT_ALLOWED, f'{info} not available')

    add_to_task_queues(player[C.UNO], game_mode, C.MATCHES_HISTORY)

    player[C.GAMES][game_mode][C.STATUS] = SGame.ENABLED
    player_get(
        db,
        uno,
        C.RAW,
        f'{player_add_game_mode.__name__} {game_mode=} {C.GAME} {C.ENABLED}',
    ).update({STT.players.games: player[C.GAMES]})
    db.commit()

    return {C.MESSAGE: f'create {info} [{player[C.GROUP]}] started'}


def player_matches_update(
    db: Session,
    uno: str,
    game_mode: GameMode,
    data_type: Literal['matches', 'matches_history'],
):
    in_logs_game_status(db, uno, game_mode, data_type, 0)

    player: PlayerBasic | None = player_get(
        db,
        uno,
        C.BASIC,
        f'{player_matches_update.__name__} {game_mode=} {data_type=}',
    )
    table = STT.get_table(game_mode, C.MATCHES).table
    query = db.query(table.time).filter(table.uno == uno)

    if data_type == C.MATCHES_HISTORY:
        # set start from oldest match time
        # then look for more oldest matches in history
        start_time = query.order_by(table.time.asc()).first()
        start_time: int = int(start_time.time.timestamp()) if start_time else 0
        end_time = 0
    else:
        # set start from now then look for matches
        # until we get to the current last match time
        start_time = 0
        end_time = query.order_by(table.time.desc()).first()
        end_time: int = int(end_time.time.timestamp()) if end_time else 0

    data = get_data_from_platforms(player, game_mode, C.MATCHES, start_time)
    player_tag: str = data[C.PLAYER_TAG]
    platform: PlatformOnly = data[C.PLATFORM]
    data: dict = data[C.DATA]

    if not data.get(C.MATCHES):
        return 0

    counter = Counter()
    is_matches_history = data_type == C.MATCHES_HISTORY
    is_have_token = settings.SESSION.cookies.get('ACT_SSO_COOKIE') is not None
    username = player[C.USERNAME][0]

    while new_matches := [
        match for match in data[C.MATCHES] if match['utcStartSeconds'] > end_time
    ]:
        for match in new_matches:
            match = MF.format_match(match, game_mode)
            match[C.UNO] = match.get(C.UNO) or uno

            new_match = table()
            new_match.__dict__.update(match)
            db.add(new_match)

            if is_matches_history is False and SGM.is_game_mode_mw(game_mode):
                fullmatches_pars(
                    db, match[C.MATCHID], game_mode, str(match[C.TIME].year)
                )

        db.commit()

        new_matches_found = len(new_matches)
        counter[C.MATCHES] += new_matches_found
        counter['pre_limit'] += new_matches_found

        if new_matches_found < settings.MATCHES_LIMIT:
            break

        if (
            is_matches_history
            and counter[C.MATCHES] > counter['temp_matches'] + settings.MATCHES_LIMIT
        ):
            in_logs_game_status(db, uno, game_mode, data_type, counter[C.MATCHES])
            counter['temp_matches'] = counter[C.MATCHES]
            if counter['pre_limit'] > settings.PARS_PRE_LIMIT:
                make_break(
                    f'{uno} {username}',
                    game_mode,
                    f'{player_matches_update.__name__} {counter['pre_limit']}',
                    2,
                )
                counter['pre_limit'] = 0

        slugs: GameDataSlugs = (
            player_tag,
            game_mode,
            C.MATCHES,
            platform,
            data[C.MATCHES][-1]['utcStartSeconds'],
        )
        data = GameData.get(slugs, 1)
        if data is None:
            if is_have_token and is_matches_history:
                make_break(
                    f'{uno} {username}',
                    game_mode,
                    f'{player_matches_update.__name__} {is_matches_history=}',
                    5,
                )
                data = GameData.get(slugs, 1)
                counter['pre_limit'] = 0
                if not (data or {}).get(C.MATCHES):
                    break
            else:
                break

    if counter[C.MATCHES]:
        while SC.new_columns:
            in_logs(
                f'{uno} {username} new column found',
                f'{SC.new_columns.pop()} {game_mode}',
                'cod_logs_error',
            )
        in_logs_cod_logs_cache(
            f'{uno} {username}', game_mode, f'{C.MATCHES} {counter[C.MATCHES]} found'
        )

        # remove cached matches for player
        uid = f'{C.MATCHES}:{C.UNO}_{uno}_{game_mode}'  # CacheUid
        redis_manage(uid, C.DELETE)

        in_logs_game_status(db, uno, game_mode, data_type, counter[C.MATCHES])
        player_matches_stats_update(db, uno, game_mode)

    return counter[C.MATCHES]


def player_logs_delete(db: Session, uno: str):
    table = LOGS_TABLES['cod_logs_player']
    deleted = db.query(table).filter(table.target == uno).delete()
    db.commit()
    in_logs(
        uno,
        f'{player_logs_delete.__name__} {C.DELETED} [{deleted}] {C.LOGS}',
        'cod_logs_player',
    )


def player_matches_delete(db: Session, uno: str, game_mode: GameMode):
    result: PlayerMatchesDeleteResponse = {
        C.MW_MP: 0,
        C.MW_WZ: 0,
        C.CW_MP: 0,
        C.VG_MP: 0,
    }
    game_modes: list[GameModeOnly] = (
        list(SGM.modes()) if game_mode == C.ALL else [game_mode]
    )

    for game_mode in game_modes:
        table = STT.get_table(game_mode, C.MATCHES).table
        result[game_mode] = db.query(table).filter(table.uno == uno).delete()

    db.commit()

    in_logs(
        uno,
        f'{player_matches_delete.__name__} {game_mode}',
        'cod_logs_player',
        result,
    )

    return result


def player_all_update(db: Session, uno: str, data_type: DataType) -> None:
    player: PlayerData | None = redis_manage(f'{C.PLAYER}:{C.UNO}_{uno}', 'hgetall')
    for game_mode in SGM.modes():
        if player[C.GAMES][game_mode][C.STATUS] != 1:
            continue

        validated = validate_update_player(player, game_mode, data_type)
        if isinstance(validated, str) is False:
            continue

        if data_type in (C.MATCHES, C.MATCHES_HISTORY):
            player_matches_update(db, uno, game_mode, data_type)
        elif data_type == C.STATS:
            stats_update_player(db, uno, game_mode)


def validate_update_player(
    player: PlayerData, game_mode: GameMode, data_type: DataType
):
    username = player[C.USERNAME][0]
    player_status: PlayerStatus = player[C.GAMES][C.ALL][C.STATUS]
    game_status = player[C.GAMES][game_mode][C.STATUS]  # SGame

    if data_type == C.MATCHES_HISTORY and player_status != SPlayerParsed.NONE:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'{C.MATCHES} [{username}] already parsed',
        )
    if data_type == C.FULLMATCHES_PARS:
        pass
    elif game_mode == C.ALL:
        pass
    elif data_type == C.MATCHES and player_status == SPlayerParsed.NONE:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'[{username}] {C.PLAYER} not {C.ENABLED}',
        )
    elif game_status == SGame.NOT_ENABLED:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'[{username}] {game_mode} not {C.ENABLED}',
        )
    elif game_status == SGame.DISABLED:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED, f'[{username}] {game_mode} {C.DISABLED}'
        )
    elif data_type == C.MATCHES and game_status == SGame.ENABLED:
        last_log = player[C.GAMES][game_mode][C.MATCHES][C.LOGS][-1]
        if seconds_wait := seconds_wait_expire(
            last_log[C.TIME], settings.MATCHES_INTERVAL_MINUTES
        ):
            return {
                C.MESSAGE: 'please wait',
                C.TIME: last_log[C.TIME],
                'seconds_wait': seconds_wait,
            }
    elif data_type == C.STATS:
        last_log = player[C.GAMES][game_mode][C.STATS][C.LOGS][-1]
        weeks = int(settings.STATS_INTERVAL_WEEKS.days / 7)
        if seconds_wait_expire(
            last_log[C.TIME],
            settings.STATS_INTERVAL_WEEKS,
        ):
            return json_error(
                status.HTTP_405_METHOD_NOT_ALLOWED,
                f'{C.TIME} interval between updates [{weeks}] weeks',
            )

    return username


def player_delete(db: Session, uno: str) -> Message | Error:
    player: Player | None = player_get(db, uno, C.RAW, player_delete.__name__).first()

    if player is None:
        in_logs(uno, f'{C.PLAYER} {C.DELETE} {C.NOT_FOUND}', 'cod_logs_player')
        return json_error(status.HTTP_404_NOT_FOUND, f'[{uno}] {C.NOT_FOUND}')

    message = f'{C.PLAYER} {C.DELETED} [{player.username[0]}]'
    db.delete(player)
    db.commit()
    set_table_sequence(db, STT.players.__tablename__)
    player_logs_delete(db, uno)
    players_cache_update(db)
    in_logs(uno, message, 'cod_logs_player')

    return {C.MESSAGE: message}


def player_put(db: Session, body: EditTarget) -> EditPlayerResponse | Error:
    target, name, value = body.target, body.name, body.value
    player_query = player_get(
        db,
        target,
        C.RAW,
        f'{player_put.__name__} {name=} {value=}',
    )
    player: PlayerData | None = player_query.first()

    if player is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{target}] {C.NOT_FOUND}')

    player = to_dict(player)

    if value == player.get(name):
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'[{name}] [{value}] same {C.VALUE} not changed',
        )

    message = ''

    if name == C.ID:
        if uno := redis_manage(f'{C.PLAYER}:{name}_{value}', 'get'):
            return json_error(status.HTTP_302_FOUND, f'used by [{uno}]')
    elif name == C.GROUP:
        if value is None:
            pass
        elif error := validate_group_name(value):
            return json_error(status.HTTP_405_METHOD_NOT_ALLOWED, error)
    elif SGM.is_game_mode(name):
        pass
    elif name == C.GAMES:
        try:
            GamesStatus.model_validate(value)
        except ValidationError:
            return json_error(
                status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} {C.NOT_VALID}'
            )
        message = 'saved'
    elif name == C.TIME:
        if isinstance(value, int) is False:
            return json_error(
                status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} {value} {C.NOT_VALID}'
            )
    else:
        return json_error(status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} not allowed')

    if SGM.is_game_mode(name):
        player_status: PlayerStatus = player[C.GAMES][C.ALL][C.STATUS]

        if name == C.ALL:
            if player_status == SPlayerParsed.NONE:
                new_player_status = SPlayerParsed.MATCHES
            elif player_status == SPlayerParsed.MATCHES:
                new_player_status = SPlayerParsed.FULLMATCHES
            elif player_status == SPlayerParsed.FULLMATCHES:
                new_player_status = SPlayerParsed.ALL_AND_DISABLED
            else:
                new_player_status = SPlayerParsed.NONE

            player[C.GAMES][C.ALL][C.STATUS] = new_player_status
            res = {
                C.MESSAGE: f'{C.PLAYER} {C.STATUS} changed to {new_player_status}',
                C.RESULT: new_player_status,
            }

        else:
            game_mode = name
            game_status = player[C.GAMES][game_mode][C.STATUS]  # SGame

            if game_status == SGame.NOT_ENABLED:
                new_game_status = SGame.ENABLED
            elif game_status == SGame.ENABLED:
                new_game_status = SGame.DISABLED
            else:
                new_game_status = SGame.NOT_ENABLED

            if game_status == SGame.NOT_ENABLED and player_status == SPlayerParsed.NONE:
                message = player_add_game_mode(
                    db,
                    TargetGameMode.model_validate(
                        {C.TARGET: player[C.UNO], C.GAME_MODE: game_mode}
                    ),
                )
                message = get_message_response(message)
            else:
                message = (
                    f'{C.GAME} {game_mode} {C.STATUS} changed to {new_game_status}'
                )

            player[C.GAMES][game_mode][C.STATUS] = new_game_status
            res = {C.MESSAGE: message, C.RESULT: new_game_status}

        player_query.update({STT.players.games: player[C.GAMES]})

    elif name == C.TIME:
        player_query.update({STT.players.__dict__[name]: date_format(value)})
        res = {
            C.MESSAGE: f'{name} changed to {date_format(value, C.DATETIME)}',
            C.RESULT: date_format(value, C.ISO),
        }

    else:
        player_query.update({STT.players.__dict__[name]: value})
        res = {C.MESSAGE: message or f'{name} changed to {value}', C.RESULT: value}

    db.commit()
    players_cache_update(db)

    return res


def get_data_from_platforms(
    player: PlayerBasic,
    game_mode: GameMode,
    data_type: Literal['matches', 'stats'],
    start_time=0,
):
    is_have_token = settings.SESSION.cookies.get('ACT_SSO_COOKIE') is not None
    attempts = 3 if is_have_token else 1
    for _ in range(attempts):
        for platform in SC.PLATFORMS[::-1]:
            player_tag = player[platform]
            if player_tag is None:
                continue
            slugs: GameDataSlugs = (
                player_tag,
                game_mode,
                data_type,
                platform,
                start_time,
            )
            if data := GameData.get(slugs, 1):
                return {C.DATA: data, C.PLAYER_TAG: player_tag, C.PLATFORM: platform}

    return {
        C.DATA: {},
        C.PLAYER_TAG: player_tag,
        C.PLATFORM: platform,  # pylint: disable=undefined-loop-variable
    }


def validate_update_group(group: GroupData, game_mode: GameMode, data_type: DataType):
    if not group[C.PLAYERS]:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'{C.PLAYERS} {C.NOT_FOUND} for {C.GROUP} [{group[C.UNO]}]',
        )

    if data_type == C.MATCHES:
        last_log = group[C.GAMES][game_mode][C.MATCHES][C.LOGS][-1]
        if seconds_wait_expire(last_log[C.TIME], datetime.timedelta(minutes=1)):
            return json_error(
                status.HTTP_405_METHOD_NOT_ALLOWED,
                'update already started wait a minute',
            )
        if seconds_wait := seconds_wait_expire(
            last_log[C.TIME], settings.MATCHES_INTERVAL_MINUTES
        ):
            return {
                C.MESSAGE: 'please wait',
                C.TIME: last_log[C.TIME],
                'seconds_wait': seconds_wait,
            }

    if data_type == C.STATS:
        pass

    if data_type == C.MATCHES_HISTORY:
        pass

    if data_type == C.FULLMATCHES_PARS:
        return 'actualize_match_ids'

    return group[C.UNO]


def task_start(db: Session, task: Task):
    uno: str = task[C.UNO]
    target_type = target_type_define(uno)
    game_mode: GameMode = task[C.GAME_MODE]
    data_type: DataType = task[C.DATA_TYPE]
    # update status for task in task queues
    task[C.STATUS] = STask.RUNNING
    task['time_started'] = now(C.ISO)
    redis_manage(C.TASK_QUEUES, 'lset', task)

    in_logs_cod_logs_cache('started', game_mode, data_type)
    start = time.perf_counter()

    try:
        if target_type == C.PLAYER:
            if game_mode == C.ALL:
                player_all_update(db, uno, data_type)
            elif data_type in (C.MATCHES, C.MATCHES_HISTORY):
                player_matches_update(db, uno, game_mode, data_type)
            elif data_type == C.STATS:
                stats_update_player(db, uno, game_mode)
            elif data_type == C.FULLMATCHES_PARS:
                fullmatches_pars_player(db, uno, game_mode)

        elif uno in target_unos_get(target_type):
            if data_type in (C.MATCHES, C.STATS):
                group_update(db, uno, game_mode, data_type)
            elif data_type == C.FULLMATCHES_PARS:
                fullmatches_pars_group(db, uno, game_mode)
        task[C.STATUS] = STask.COMPLETED
    except Exception as e:
        in_logs(
            task[C.NAME],
            type(e).__name__,
            'cod_logs_error',
            {'trace': traceback.format_exc()},
        )
        task[C.STATUS] = STask.ERROR
    finally:
        # pop from begining queues list
        redis_manage(C.TASK_QUEUES, 'lpop')
        # save task in queues log
        task[C.DATA][C.SOURCE] = task_start.__name__
        in_logs_queues(db, task)

        message = f'{task[C.STATUS]} {data_type} [{time_taken_get(start)}]'

        if target_type == C.PLAYER:
            username = redis_manage(f'{target_type}:{C.UNO}_{uno}', 'hget', C.USERNAME)
            username = username[0] if username else uno
            in_logs_cod_logs_cache(username, game_mode, message)
            in_logs(uno, f'{game_mode} {message}', 'cod_logs_player')
        else:
            in_logs_cod_logs_cache(uno, game_mode, message)
            in_logs(uno, message, 'cod_logs')


def group_update(db: Session, uno: str, g_game_mode: GameMode, data_type: DataTypeOnly):
    players = redis_manage(f'{C.GROUP}:{C.UNO}_{uno}', 'hget', C.PLAYERS)
    g_game, g_mode = SGM.desctruct_game_mode(g_game_mode)
    isAllUpdate = g_game_mode == uno == C.ALL
    game_modes = SGM.modes(g_game, g_mode)
    players: list[PlayerData] = list(players.values())

    update_players = []

    if data_type != C.STATS:
        for game_mode in game_modes:
            in_logs_game_status(db, uno, game_mode, data_type, 0)

    # Fill players list in store with players who can update
    for player in players:
        update_player = {
            C.UNO: player[C.UNO],
            C.PLAYER: player[C.USERNAME][0],
            C.GROUP: player[C.GROUP],
        }
        for game_mode in game_modes:
            player_status: PlayerStatus = player[C.GAMES][C.ALL][C.STATUS]
            game_status = player[C.GAMES][game_mode][C.STATUS]  # SGame

            player_active_status = player_status in (
                SPlayerParsed.MATCHES,
                SPlayerParsed.FULLMATCHES,
            )

            if game_status == SGame.ENABLED and (
                data_type == C.STATS or player_active_status
            ):
                update_player[game_mode] = STask.PENDING

            elif data_type == C.MATCHES and (
                (
                    game_status == SGame.ENABLED
                    and player_status == SPlayerParsed.ALL_AND_DISABLED
                )
                or (game_status == SGame.DISABLED and player_active_status)
            ):
                update_player[game_mode] = 'skipped'
                in_logs_cod_logs_cache(
                    update_player[C.PLAYER], game_mode, f'{data_type} skipped'
                )

            else:
                update_player[game_mode] = C.NOT_FOUND
        update_players.append(update_player)
    redis_manage(C.UPDATE_PLAYERS, 'rpush', update_players)

    game_counts = {game_mode: 0 for game_mode in SGM.modes()}
    group_game_counts = {C.ALL: copy.deepcopy(game_counts)}
    for index, update_player in enumerate(update_players):
        group_game_counts.setdefault(update_player[C.GROUP], copy.deepcopy(game_counts))

        for game_mode in game_modes:
            if update_player.get(game_mode) != STask.PENDING:
                continue
            if data_type == C.STATS:
                stats_update_player(db, update_player[C.UNO], game_mode)
                update_player[game_mode] = 1
                continue

            count = player_matches_update(
                db, update_player[C.UNO], game_mode, C.MATCHES
            )
            update_player[game_mode] = count
            group_game_counts[update_player[C.GROUP]][game_mode] += count
            group_game_counts[C.ALL][game_mode] += count

            redis_manage(C.UPDATE_PLAYERS, 'lset', update_player, index)

    if data_type == C.MATCHES:
        for group_name, group_game_count in group_game_counts.items():
            for game_mode, records in group_game_count.items():
                in_logs_game_status(db, group_name, game_mode, data_type, records)

    redis_manage(C.UPDATE_PLAYERS, 'ltrim')
    all_found = sum(group_game_counts[C.ALL].values())
    in_logs_cod_logs_cache(
        f'{uno} {data_type}', g_game_mode, f'{C.MATCHES} {all_found or C.NOT_FOUND}'
    )
    if all_found == 0:
        return

    players_cache_update(db)
    if isAllUpdate:
        update_matches_stats(db)
        update_chart(db)
        # tracker_stats_update(db)


def fullmatches_pars(db: Session, matchID: str, game_mode: GameMode, year: YearWzTable):
    table = STT.get_table(game_mode, C.MAIN, year).table
    if db.query(table.id).filter(table.matchID == matchID).count():
        return  # already have match

    data = GameData.get((matchID, game_mode, C.FULLMATCHES, C.BATTLE, 0), 1)

    if not (data or {}).get('allPlayers'):
        return False

    for match in data['allPlayers']:
        match = MF.format_match(match, game_mode)
        if C.UNO not in match:
            in_logs(
                f'{game_mode} {matchID}',
                f'{C.UNO} {C.NOT_FOUND}',
                'cod_logs_error',
                {C.USERNAME: match.get(C.USERNAME), C.MATCHID: match[C.MATCHID]},
            )
            continue

        new_match = table()
        new_match.__dict__.update(match)
        db.add(new_match)

    # Check if double in basic table and delete
    basic_table = STT.get_table(game_mode, C.BASIC, year).table
    basic_matches = (
        db.query(basic_table.id).filter(basic_table.matchID == matchID).all()
    )
    for match in basic_matches:
        db.delete(match)
        in_logs(
            matchID,
            f'[{match.matchID}] [{match.id}] {game_mode} {C.BASIC} {year} {C.DELETED}',
            'cod_logs',
        )

    db.commit()

    return True


def fullmatches_pars_group(db: Session, uno: str, game_mode: GameMode):
    game, mode = SGM.desctruct_game_mode(game_mode)
    game_modes = SGM.modes(game, mode).items()
    players = redis_manage(f'{C.GROUP}:{C.UNO}_{uno}', 'hget', C.PLAYERS)

    for game_mode, (game, mode) in game_modes:
        fullmatch_tables = STT.get_tables(game, mode, C.MAIN)
        table = STT.get_table(game_mode).table

        full_match_ids = set()
        seen_match_ids = []
        pars_list: list[FullmatchData] = []

        for t in fullmatch_tables:
            full_matches_ids = db.query(
                t.table.matchID.distinct(), t.table.matchID
            ).all()
            for match in full_matches_ids:
                if match.matchID not in full_match_ids:
                    full_match_ids.add(match.matchID)

        match_ids = (
            db.query(table.matchID.distinct(), table.matchID, table.time)
            .filter(table.uno.in_(players))
            .all()
        )
        for match in match_ids:
            if match.matchID in seen_match_ids:
                continue
            if match.matchID not in full_match_ids:
                pars_list.append(
                    {C.MATCHID: match.matchID, C.YEAR: str(match.time.year)}
                )
                seen_match_ids.append(match.matchID)

        info = f'started actualize {C.FULLMATCHES}, '
        info += f'{len(pars_list)} {C.MATCHES} found from {len(match_ids)}'
        in_logs_cod_logs_cache(uno, game_mode, info)
        in_logs(uno, info, 'cod_logs')

        fullmatches_pars_pack(db, pars_list, game_mode)


def fullmatches_pars_player(db: Session, uno: str, game_mode: GameMode):
    table = STT.get_table(game_mode).table
    pars_list = db.query(table.matchID, table.time)
    pars_list = pars_list.filter(table.uno == uno).all()
    pars_list: list[FullmatchData] = [
        {C.MATCHID: match.matchID, C.YEAR: str(match.time.year)} for match in pars_list
    ]
    fullmatches_pars_pack(db, pars_list, game_mode)
    player_matches_stats_update(db, uno, game_mode)


def fullmatches_pars_pack(
    db: Session, pars_list: list[FullmatchData], game_mode: GameMode
):
    is_parsed = False
    log_count = 0
    fail_count = 0

    for index, match in enumerate(pars_list):
        if (tracker_status := redis_manage(C.STATUS)) != C.ACTIVE:
            in_logs(
                tracker_status or C.DISABLED,
                f'pars {C.FULLMATCHES} pack stopped',
                'cod_logs',
            )
            break

        if fail_count > 3:
            message = f'stopped due to a large number of {C.ERROR}'
            in_logs_cod_logs_cache(f'{C.FULLMATCHES} pars', game_mode, message)
            in_logs(f'{C.FULLMATCHES} pack', message, 'cod_logs_error')
            break

        is_parsed = fullmatches_pars(db, match[C.MATCHID], game_mode, match[C.YEAR])

        if is_parsed is None:
            continue
        if is_parsed is False:
            fail_count += 1
        else:
            fail_count = 0

        if index > log_count + 20:
            log_count = index
            message = f'{index}-{len(pars_list)} progress'
            in_logs_cod_logs_cache(f'{C.FULLMATCHES} pars', game_mode, message)
            in_logs(f'{C.FULLMATCHES} pack {game_mode}', message, 'cod_logs')

        db.commit()

    return is_parsed


def fullmatches_delete(
    db: Session, matchID: str, game_mode: GameMode, year: YearWzTable
):
    data = match_data_get(db, matchID, game_mode, False, year)

    if data is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.MATCHID} [{matchID}] {C.NOT_FOUND}'
        )

    t: TableGameData = data['table_data']
    rows_deleted = db.query(t.table).filter(t.table.matchID == matchID).delete()
    db.commit()

    return rows_deleted


def fullmatches_load(db: Session, game_mode: GameMode):
    directory = Path.cwd().parent / C.STATIC / C.FILES / C.DATA
    directory = directory / C.FULLMATCHES / game_mode
    fullmatches_files = list(directory.iterdir())

    total_steps = len(fullmatches_files)
    percent_step = 0

    for index, fullmatch in enumerate(fullmatches_files, 1):
        current_percent = int((index / total_steps) * 100)
        if current_percent > percent_step:
            percent_step = current_percent
            print(f'{index} / {total_steps} {current_percent}%')

        if (percent_step % 10) == 0:
            print('commit progress')
            db.commit()

        with open(fullmatch, 'r', encoding='utf8') as file:
            data = json.load(file)

        players = data[C.DATA].get('allPlayers')

        if not players:
            print(f'{fullmatch.name} {C.PLAYERS} {C.NOT_FOUND}')
            continue

        year = str(date_format(players[0]['utcStartSeconds']).year)
        match_id = players[0][C.MATCHID]
        table = STT.get_table(game_mode, C.MAIN, year).table

        if found := db.query(table.id).filter(table.matchID == match_id).count():
            print(
                f'{match_id} {C.ALREADY_EXIST}',
                f'{C.PLAYERS}: {len(players)}',
                f'found rows: {found}',
            )
            continue

        for player_match in players:
            player_match = MF.format_match(player_match, game_mode)
            if C.UNO not in player_match:
                in_logs(
                    f'{game_mode} {match_id}',
                    f'{C.UNO} {C.NOT_FOUND}',
                    'cod_logs_error',
                    {C.USERNAME: player_match.get(C.USERNAME), C.MATCHID: match_id},
                )
                continue

            new_match = table()
            new_match.__dict__.update(player_match)
            db.add(new_match)

    db.commit()


def stats_router(db: Session, body: StatsRouter) -> GameStats | Error:
    target_type = target_type_define(body.uno)
    if target_type == C.PLAYER:
        return stats_get_player(db, body.uno, body.game)

    return json_error(status.HTTP_404_NOT_FOUND, f'[{body.uno}] {C.NOT_FOUND}')


def stats_get_player(db: Session, uno: str, game: Game) -> GameStats | Error:
    username, games = redis_manage(
        f'{C.PLAYER}:{C.UNO}_{uno}', 'hmget', (C.USERNAME, C.GAMES)
    )

    if not username:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.PLAYER} {C.UNO} [{uno}] {C.NOT_FOUND}'
        )

    game_mode = game if game == C.ALL else f'{game}_{C.MP}'

    if game_mode != C.ALL and games[game_mode][C.STATUS] == SGame.NOT_ENABLED:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'[{username[0]}] {game_mode} not {C.ENABLED}',
        )

    game_stats = player_get(
        db,
        uno,
        C.GAMES_STATS,
        f'{stats_get_player.__name__} {game=}',
    ).get(game)

    if not game_stats:
        if game_mode != C.ALL:
            add_to_task_queues(uno, game_mode, C.STATS)
        return json_error(status.HTTP_404_NOT_FOUND, f'{C.STATS} {C.NOT_FOUND}')

    return game_stats


def stats_add_summary_all_modes(games_stats: dict[Game, GameStats]):
    # remove and initial new summary_all_modes
    games_stats.pop(C.ALL, None)
    games_stats_all = {}

    for game_stats in games_stats.values():
        for stats_name, stats_values in game_stats.items():
            stats = games_stats_all.get(stats_name, {})

            if stats_name in (C.ALL, 'all_additional'):
                for stat_name, stat_value in stats_values.items():
                    # create stat name if doesn't exist
                    stats[stat_name] = stats.get(stat_name, 0)

                    if is_best_record(stat_name):
                        if stat_value > stats[stat_name]:
                            # replace if better than previous
                            stats[stat_name] = stat_value
                    else:
                        stats[stat_name] += stat_value
            else:
                for weapon_name, weapon_value in stats_values.items():
                    stats[weapon_name] = stats.get(weapon_name, {})

                    for stat_name, stat_value in weapon_value.items():
                        stats[weapon_name][stat_name] = stats[weapon_name].get(
                            stat_name, 0
                        )
                        stats[weapon_name][stat_name] += stat_value

            games_stats_all[stats_name] = stats

    games_stats_all[C.ALL] = correct_ratio(games_stats_all[C.ALL])
    games_stats[C.ALL] = games_stats_all

    return games_stats


def stats_update_player(db: Session, uno: str, game_mode: GameModeOnly):
    in_logs_game_status(db, uno, game_mode, C.STATS, 0)

    game = SGM.desctruct_game_mode(game_mode)[0]
    player: Player | None = player_get(
        db,
        uno,
        C.ALL,
        f'{stats_update_player.__name__} {game_mode=}',
    )

    data = get_data_from_platforms(player, game_mode, C.STATS)[C.DATA]

    if data is None or data.get('title') is None:
        return

    player[C.GAMES_STATS][game] = game_stats_format(data['lifetime'], game)
    player[C.GAMES_STATS] = stats_add_summary_all_modes(player[C.GAMES_STATS])

    player_get(db, uno, C.RAW, f'{stats_update_player.__name__} set {C.STATS}').update(
        {STT.players.games_stats: player[C.GAMES_STATS]}
    )
    db.commit()

    in_logs_game_status(
        db,
        uno,
        game_mode,
        C.STATS,
        player[C.GAMES_STATS][game][C.ALL]['totalGamesPlayed'],
    )

    return player[C.GAMES_STATS]


def validate_update(uno: str, game_mode: GameMode, data_type: UpdateRouterDataType):
    target_type = target_type_define(uno)
    target_data = redis_manage(f'{target_type}:{C.UNO}_{uno}', 'hgetall')

    if not target_data:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{uno}] {C.NOT_FOUND}')

    if target_type == C.PLAYER:
        validated = validate_update_player(target_data, game_mode, data_type)
    else:
        validated = validate_update_group(target_data, game_mode, data_type)

    if isinstance(validated, str) is False:
        return validated

    if (tracker_status := redis_manage(C.STATUS)) != C.ACTIVE:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'fetch {C.DATA} {tracker_status or C.INACTIVE}',
        )

    task_status = add_to_task_queues(uno, game_mode, data_type)

    if task_status in (STaskStatus.ALREADY_RUNNING, STaskStatus.IN_QUEUES):
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'{validated} {game_mode} {data_type} {task_status}',
        )

    return {C.MESSAGE: f'{validated} | {game_mode} | {data_type} | {task_status}'}


def update_router(body: UpdateRouter) -> UpdateResponse | Error:
    data_type, uno, game_mode = body.data_type, body.uno, body.game_mode

    if data_type == C.ALL:
        validate_update(uno, game_mode, C.STATS)
        validate_update(uno, game_mode, C.MATCHES)
        return {C.MESSAGE: f'{C.STATS} and {C.MATCHES} start update'}

    return validate_update(uno, game_mode, data_type)


def matches_router(db: Session, body: Router) -> MatchesResponse:
    data_type, target = body.data_type, body.target
    game, mode, game_mode = body.game, body.mode, body.game_mode
    order, date, page = body.order, body.date, body.page

    not_found_msg = f'{C.MATCHES} {data_type} [{target}] {C.NOT_FOUND}'

    games: GamesStatus = {}
    tables = []
    query_target = ''

    if data_type == C.UNO:
        target_type = target_type_define(target)

        if target == C.TRACKER:
            pass

        elif target_type == C.GROUP:
            group_games, players = redis_manage(
                f'{target_type}:{C.UNO}_{target}', 'hmget', [C.GAMES, C.PLAYERS]
            )
            if not players:
                return json_error(
                    status.HTTP_404_NOT_FOUND,
                    f'{C.PLAYERS} for {C.GROUP} [{target}] {C.NOT_FOUND}',
                )

            games = group_games
            tables = STT.get_tables(game, mode, C.MATCHES)
            query_target = (
                f'WHERE {data_type} in ({', '.join((f"'{uno}'" for uno in players))})'
            )

        elif target_type == C.PLAYER:
            player_games, player_group = redis_manage(
                f'{target_type}:{C.UNO}_{target}', 'hmget', [C.GAMES, C.GROUP]
            )
            if player_group and player_games:
                # target from tracker so search only in matches tables
                games = player_games
                tables = STT.get_tables(game, mode, C.MATCHES)

    elif "'" in target or ':' in target:  # sanitize target
        search_target = target.translate(str.maketrans({"'": "''", ":": r"\:"}))
        query_target = f"WHERE {data_type} LIKE '%{search_target}%'"

    if date:
        not_found_msg += f' {C.DATE} [{date}]'
        date_length: Literal[1, 2, 3] = len(date.split('-'))
        get_by = 'day' if date_length == 3 else 'month' if date_length == 2 else 'year'
        query_date = (
            f"date_trunc('{get_by}', {C.TIME}) = to_date('{date}','YYYY-MM-DD')"
        )
    else:
        query_date = ''

    games = games or {game_mode: {C.STATUS: 1} for game_mode in SGM.modes(C.ALL, C.ALL)}
    tables = tables or STT.get_tables_all(game, mode)
    query_target = query_target or f"WHERE {data_type} = '{target}'"
    selects: list[str] = []

    for t in tables:
        if games[t.game_mode][C.STATUS] == SGame.NOT_ENABLED:
            continue
        is_mw = SGM.is_game_mode_mw(t.game_mode)
        if is_mw is False and data_type == C.CLANTAG:
            continue
        if is_mw is False and data_type == C.USERNAME:
            # search player uno for searched username
            search_uno = redis_manage(f'{C.PLAYER}:{C.USERNAME}_{target}', 'get')
            if search_uno is None:
                continue
            query_table = f"WHERE {C.UNO} = '{search_uno}'"
        else:
            query_table = query_target

        if query_date:
            query_table += ' AND ' if query_table else 'WHERE '
            query_table += query_date

        selects.append(
            f'''
SELECT '{t.game_mode}' AS {C.GAME_MODE}, '{t.source}' AS {C.SOURCE}, \
{C.USERNAME if is_mw else f'null AS {C.USERNAME}'}, \
{C.LOADOUT if is_mw and t.source != C.BASIC else f'null AS {C.LOADOUT}'},
{', '.join(map(format_column, SC.BASIC_STATS))}
FROM {t.name} {query_table}
'''
        )

    if not selects:
        return json_error(status.HTTP_404_NOT_FOUND, not_found_msg)

    sql = '\nUNION\n'.join(selects)
    offset = 0 if page < 1 else (page - 1) * settings.PAGE_LIMIT
    found: int = db.execute(text(sql)).rowcount if offset == 0 else 0
    column = order.strip('-')
    order_direction = 'DESC' if order[0] == '-' else 'ASC'

    sql += f'\nORDER BY {format_column(column)} {order_direction}'
    if column != C.TIME:
        sql += f', {C.TIME} {order_direction}'

    sql += f' LIMIT {settings.PAGE_LIMIT} OFFSET {offset}'
    matches_raw = list(map(to_dict, db.execute(text(sql)).fetchall()))
    matches_loaded: int = len(matches_raw)

    if matches_loaded == 0 and page < 2:
        # if data_type == C.UNO and target_type == C.PLAYER:
        #     username: list[str] | None = redis_manage(
        #         f'{C.PLAYER}:{C.UNO}_{target}', 'hget', C.USERNAME
        #     )
        #     if username:
        #         # try find player from fullmatshes table
        #         body.target = username[0]
        #         body.data_type = C.USERNAME
        #         return matches_router(db, body)
        return json_error(status.HTTP_404_NOT_FOUND, not_found_msg)

    # Format matches for table row
    matches: list[MatchesData] = []
    for match_raw in matches_raw:
        match = {
            C.GAME_MODE: match_raw[C.GAME_MODE],
            C.ID: match_raw[C.ID],
            C.TIME: date_format(match_raw[C.TIME], C.ISO),
            C.PLAYER: (
                match_raw.get(C.USERNAME)
                or (
                    redis_manage(
                        f'{C.PLAYER}:{C.UNO}_{match_raw[C.UNO]}', 'hget', C.USERNAME
                    )
                    or [None]
                )[0]
                or target
            ),
            C.MATCHID: match_raw.get(C.MATCHID, 'unknown'),
            C.MAP: MF.get_mode(match_raw.get(C.MAP), C.MAP, match_raw[C.GAME_MODE]),
            C.MODE: MF.get_mode(match_raw.get(C.MODE), C.MODE, match_raw[C.GAME_MODE]),
            C.RESULT: match_raw.get(C.RESULT) or 0,
            C.LOADOUT: MF.format_loadout([match_raw.get(C.LOADOUT) or '']),
            C.SOURCE: match_raw[C.SOURCE],
        } | {
            stat_name: match_raw.get(stat_name, 0)
            for stat_name in SC.GAME_BASIC_COLUMNS
        }
        matches.append(match)

    res: MatchesResponse = {
        C.MATCHES: matches,
        'found': found,
    }

    # only player with fully parsed matches history
    # if games[C.ALL][C.STATUS] > SPlayerParsed.NONE:

    uid = f'{C.MATCHES}:{data_type}_{target}_{game_mode}'  # CacheUid
    key = f'{order}_{date}_{page}'  # CacheKey
    redis_manage(uid, 'hset', {key: res})

    return res


def match_data_get(
    db: Session,
    matchID: str,
    game_mode: GameModeMw,
    need_pars: bool,
    year: YearWzTable | None = None,
):
    if not matchID:
        return

    game, mode = SGM.desctruct_game_mode(game_mode)
    tables = STT.get_tables(game, mode, C.ALL, year)
    columns_basic = SC.MATCH[game_mode][C.BASIC]

    for t in tables:
        select_columns = (t.table.__dict__.get(column) for column in columns_basic)
        match_query = db.query(*select_columns).filter(t.table.matchID == matchID).all()
        if match_query:
            players: list[MatchPlayer] = []
            for player in match_query:
                player = to_dict(player)
                players.append(
                    {
                        C.ID: player[C.ID],
                        C.UNO: player[C.UNO],
                        C.USERNAME: player[C.USERNAME],
                        C.CLANTAG: player[C.CLANTAG],
                        C.RESULT: player[C.RESULT],
                        C.STATS: {
                            stat_name: player.get(stat_name) or 0
                            for stat_name in SC.MATCH_STATS
                        },
                    }
                )

            return {C.PLAYERS: players, 'table_data': t}

    is_have_token = settings.SESSION.cookies.get('ACT_SSO_COOKIE') is not None

    if need_pars and is_have_token:
        # Check if matchID from our game table and get the year of the match
        table = STT.get_table(game_mode).table
        match = db.query(table.time)
        match = match.filter(table.matchID == matchID).first()
        if match is None:
            return
        pars_list: list[FullmatchData] = [
            {C.MATCHID: matchID, C.YEAR: str(match.time.year)}
        ]
        is_parsed = fullmatches_pars_pack(db, pars_list, game_mode)
        if is_parsed is True:
            return match_data_get(db, matchID, game_mode, False)


def match_get(db: Session, matchID: str, game_mode: GameModeMw) -> MatchData | Error:
    data = match_data_get(db, matchID, game_mode, True)

    if data is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.MATCHID} [{matchID}] {C.NOT_FOUND}'
        )

    t: TableGameData = data['table_data']
    meta_columns = (t.table.__dict__[column] for column in SC.MATCH[game_mode]['meta'])
    match_meta = db.query(*meta_columns).filter(t.table.matchID == matchID)
    match_meta = to_dict(match_meta.first())
    match: MatchData = {
        C.MAP: MF.get_mode(match_meta.get(C.MAP), C.MAP, game_mode),
        C.MODE: MF.get_mode(match_meta.get(C.MODE), C.MODE, game_mode),
        C.DURATION: date_format(match_meta.get(C.DURATION), C.TIME),
        C.TIME: match_meta[C.TIME],
        C.SOURCE: t.source,
        C.STATS: {stat_name: 0 for stat_name in SC.MATCH_STATS},
        C.TEAM: [],
    }
    score_win = max(match_meta.get('team1Score', 0), match_meta.get('team2Score', 0))
    score_loss = min(match_meta.get('team1Score', 0), match_meta.get('team2Score', 0))
    team: dict[str, TeamData] = {}

    for player in data[C.PLAYERS]:
        if game_mode == C.MW_WZ:
            team_name = player.pop(C.TEAM, None) or str(player[C.RESULT])
        elif player[C.RESULT] == MatchResultMp.WIN:
            team_name = 'win'
        elif player[C.RESULT] == MatchResultMp.LOSS:
            team_name = 'loss'
        else:
            team_name = 'draw'

        if team_name not in team:
            team[team_name] = {
                C.NAME: team_name,
                C.PLAYERS: [],
                C.RESULT: (
                    player[C.RESULT]
                    if game_mode == C.MW_WZ
                    else (
                        score_win
                        if player[C.RESULT] == MatchResultMp.WIN
                        else score_loss
                    )
                ),
                C.STATS: {stat_name: 0 for stat_name in SC.MATCH_STATS},
            }
        team_stats = team[team_name][C.STATS]
        team[team_name][C.PLAYERS].append(player)
        for stat_name in SC.MATCH_STATS:
            if is_best_record(stat_name):
                if player[C.STATS][stat_name] > team_stats[stat_name]:
                    team_stats[stat_name] = player[C.STATS][stat_name]
                if player[C.STATS][stat_name] > match[C.STATS][stat_name]:
                    match[C.STATS][stat_name] = player[C.STATS][stat_name]
            else:
                team_stats[stat_name] += player[C.STATS][stat_name]
                match[C.STATS][stat_name] += player[C.STATS][stat_name]

    match[C.STATS] = correct_ratio(match[C.STATS])
    for team_name, team_data in team.items():
        team_data[C.STATS] = correct_ratio(team_data[C.STATS])
        match[C.TEAM].append(team_data)

    return match


def clear_fullmatches_doubles(
    db: Session, body: ClearFullmatchDoublesBody
) -> ClearFullmatchesDoublesResponse | Error:
    data = match_data_get(db, body.matchID, body.game_mode, False)

    if data is None:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'[{body.matchID}] {body.game_mode} {C.NOT_FOUND}',
        )

    match_unos: set[str] = set()
    result = []
    table = data['table_data'].table

    for player in data[C.PLAYERS]:
        uno: str = player[C.UNO]
        if uno in match_unos:
            result.append(
                {
                    C.UNO: uno,
                    C.ID: player[C.ID],
                    C.USERNAME: player[C.USERNAME],
                }
            )
            db.query(table).filter(table.id == player[C.ID]).delete()
        else:
            match_unos.add(uno)

    if not result:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'[{body.matchID}] {body.game_mode} doubles {C.NOT_FOUND}',
        )

    db.commit()

    message = f'[{body.matchID}] {body.game_mode} doubles {C.DELETED} [{len(result)}]'

    in_logs(
        clear_fullmatches_doubles.__name__,
        message,
        'cod_logs',
        {C.RESULT: result, 'table': data['table_data'].name},
    )

    return {
        C.MESSAGE: message,
        C.RESULT: result,
    }


def player_clear_match_doubles(db: Session, uno: str, game_mode: GameMode) -> Message:
    if game_mode == C.ALL:
        messages = ''
        for game_mode in SGM.modes():
            message = player_clear_match_doubles(db, uno, game_mode)
            messages += f'{message}\n'
        return {C.MESSAGE: messages}

    table = STT.get_table(game_mode).table
    matches = db.query(table.id, table.matchID).filter(table.uno == uno).all()

    match_ids = []
    doubles_found = 0

    for match in matches:
        if match.matchID in match_ids:
            db.query(table).filter(table.id == match.id).delete()
            doubles_found += 1
            in_logs(
                match.matchID,
                f'{game_mode} [{match.id}] double {C.DELETED}',
                'cod_logs',
            )
        else:
            match_ids.append(match.matchID)

    message = f'{game_mode} {C.DELETED} [{doubles_found}] doubles'

    if doubles_found:
        db.commit()
        in_logs(uno, message, 'cod_logs_player')

    return {C.MESSAGE: message}


def clear_players_match_doubles(db: Session):
    players: dict[str, TargetDataBasic] = redis_manage(
        f'{C.GROUP}:{C.UNO}_{C.ALL}', 'hget', C.PLAYERS
    )

    for player in players.values():
        for game_mode in SGM.modes():
            if player[C.GAMES][game_mode][C.STATUS] > SGame.NOT_ENABLED:
                player_clear_match_doubles(db, player[C.UNO], game_mode)


def match_stats_get(db: Session, body: MatchBody) -> MatchStatsPlayer | Error:
    t = STT.get_table(body.game_mode, body.source, body.year)

    if not t:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.SOURCE} {C.MATCH} {C.STATS} {C.NOT_FOUND}'
        )

    match_data = db.query(t.table).filter(t.table.id == body.match_id).first()

    if match_data is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{body.match_id}] {C.NOT_FOUND}')

    match_data = to_dict(match_data)
    uno = match_data.pop(C.UNO)

    username: str | None = (
        match_data.pop(C.USERNAME, None)
        or (redis_manage(f'{C.PLAYER}:{C.UNO}_{uno}', 'hget', C.USERNAME) or [None])[0]
        or 'unknown'
    )

    match_stats: MatchStatsPlayer = {
        C.ID: match_data.pop(C.ID),
        C.UNO: uno,
        C.USERNAME: username,
        C.CLANTAG: match_data.pop(C.CLANTAG, None),
        C.RESULT: match_data.pop(C.RESULT),
        C.MATCHID: match_data.pop(C.MATCHID),
        C.MAP: MF.get_mode(match_data.pop(C.MAP), C.MAP, body.game_mode),
        C.MODE: MF.get_mode(match_data.pop(C.MODE), C.MODE, body.game_mode),
        C.TEAM: match_data.pop(C.TEAM) or 'unknown',
        C.LOADOUT: MF.decode_loadout(match_data.pop(C.LOADOUT, None)),
        'weaponStats': MF.decode_weapon_stats(match_data.pop('weaponStats', None)),
        C.SOURCE: C.ALL if body.source in Year.__args__ else body.source,
        C.TIME: match_data.pop(C.TIME),
        C.STATS: {
            # order basic stats at first place
            stat_name: match_data.pop(stat_name)
            for stat_name in SC.GAME_BASIC_COLUMNS
            if match_data.get(stat_name)
        }
        | {
            stat_name: stat_value
            for stat_name, stat_value in match_data.items()
            if stat_value
        },
    }

    for stat_name in (
        C.DURATION,
        C.TIME_PLAYED,
        'teamSurvivalTime',
        'timePlayedAlive',
    ):
        if stat_name in match_stats[C.STATS]:
            match_stats[C.STATS][stat_name] = date_format(
                match_stats[C.STATS][stat_name], C.TIME
            )

    return match_stats


def fill_all_matches(
    db: Session,
    tables: list[TableGameData],
    player_unos: set[str],
):
    all_matches = defaultdict(set[str])

    for t in tables:
        # find match_ids for searched unos
        match_ids = (
            db.query(t.table.matchID.distinct(), t.table.matchID)
            .filter(t.table.uno.in_(player_unos))
            .all()
        )
        match_ids = tuple(match.matchID for match in match_ids)

        # collect unos for every match
        for match_id in match_ids:
            match_unos = db.query(t.table.uno).filter(t.table.matchID == match_id).all()
            for match in match_unos:
                if is_none_value(match.uno) is False:
                    all_matches[match_id].add(match.uno)

    tuple_all_matches = tuple(set(unos) for unos in all_matches.values())

    return tuple_all_matches


@log_time_wrap
def loadout_update(db: Session):
    player_to_group: dict[str, str] = {}
    for uno in target_unos_get(C.PLAYER):
        if player_group := redis_manage(f'{C.PLAYER}:{C.UNO}_{uno}', 'hget', C.GROUP):
            player_to_group[uno] = player_group

    game_modes = SGM.modes(C.MW)
    targets: dict[str, dict[GameMode, list[LoadoutStatsData]]] = {
        uno: {game_mode: [] for game_mode in game_modes}
        for uno in (
            set(player_to_group) | set(player_to_group.values()) | {C.ALL, C.TRACKER}
        )
    }

    # fill player loadout
    for game_mode in game_modes:
        table = STT.get_table(game_mode).table
        matches = db.query(table.loadout, table.uno).all()
        for match in matches:
            if not match.loadout:
                continue
            targets[C.TRACKER][game_mode].append(match.loadout)
            if match.uno in targets:
                targets[match.uno][game_mode].append(match.loadout)

    # summary player loadout by groups
    for uno, loadout in targets.items():
        player_group = player_to_group.get(uno)
        if player_group is None:
            continue
        for game_mode, game_mode_loadout in loadout.items():
            targets[player_group][game_mode] += game_mode_loadout
            targets[C.ALL][game_mode] += game_mode_loadout

    for uno, loadout in targets.items():
        # summary all game_mode loadout
        loadout[C.ALL] = [
            i for game_mode_loadout in loadout.values() for i in game_mode_loadout
        ]
        # sort and save top 50 game_mode loadout
        for game_mode, game_mode_loadout in loadout.items():
            loadout[game_mode] = sorted(
                (
                    {C.NAME: name, C.COUNT: count}
                    for name, count in MF.format_loadout(game_mode_loadout).items()
                    if 'fists' not in name.lower()
                ),
                key=lambda x: x[C.COUNT],
                reverse=True,
            )[:50]
        target_data_stats_save(db, uno, C.LOADOUT, loadout)


@log_time_wrap
def update_chart(db: Session) -> None:
    player_to_group: dict[str, str] = {}
    for uno in target_unos_get(C.PLAYER):
        if player_group := redis_manage(f'{C.PLAYER}:{C.UNO}_{uno}', 'hget', C.GROUP):
            player_to_group[uno] = player_group

    # Fill targets with game modes
    targets: dict[str, dict[GameMode, list[str]]] = {
        uno: {game_mode: [] for game_mode in SGM.modes(C.ALL, C.ALL)}
        for uno in (
            set(player_to_group) | set(player_to_group.values()) | {C.ALL, C.TRACKER}
        )
    }

    game_tables = STT.get_tables(C.ALL, C.ALL, C.MATCHES)
    for t in game_tables:
        query = db.query(t.table.time, t.table.uno).all()
        # Fill match dates to all, groups, players.
        for match in query:
            date = date_format(match.time, C.DATE)
            targets[C.TRACKER][C.ALL].append(date)
            targets[C.TRACKER][t.game_mode].append(date)
            if match.uno not in targets:
                continue
            # fill dates for player
            targets[match.uno][C.ALL].append(date)
            targets[match.uno][t.game_mode].append(date)
            # fill dates for group
            player_group = player_to_group[match.uno]
            targets[player_group][C.ALL].append(date)
            targets[player_group][t.game_mode].append(date)
            # fill dates for all
            targets[C.ALL][C.ALL].append(date)
            targets[C.ALL][t.game_mode].append(date)

    for uno, chart in targets.items():
        for game_mode, dates_list in chart.items():
            years: dict[Year, dict[str, int]] = {
                year: {
                    'summ': 0,
                    'months': {},
                }
                for year in Year.__args__
            }
            dates_count = {i: dates_list.count(i) for i in sorted(set(dates_list))}
            for date, count in dates_count.items():
                year, month, day = tuple(map(lambda x: str(int(x)), date.split('-')))
                years[year]['summ'] += count
                years[year]['months'].setdefault(month, {'summ': 0, 'days': {}})
                years[year]['months'][month]['summ'] += count
                years[year]['months'][month]['days'][day] = count

            chart[game_mode] = {'summ': len(dates_list), 'years': years}

        target_data_stats_save(db, uno, C.CHART, chart)


@log_time_wrap
def update_matches_stats(db: Session) -> None:
    for uno in target_unos_get(C.PLAYER):
        player_matches_stats_update(db, uno, C.ALL)
    players_cache_update(db)


def matches_stats_game_mode_count(
    db: Session, uno: str, game_mode: GameModeOnly
) -> MatchesStats:
    # Get all matches matchID for player
    table_matches = STT.get_table(game_mode).table
    matches_ids = [
        match.matchID
        for match in db.query(table_matches.matchID.distinct(), table_matches.matchID)
        .filter(table_matches.uno == uno)
        .all()
    ]

    matches_stats: MatchesStats = {
        C.MATCHES: len(matches_ids),
        C.FULLMATCHES: 0,
        C.PLAYED: get_played_stat(db, uno, game_mode),
    }

    if SGM.is_game_mode_mw(game_mode):
        game, mode = SGM.desctruct_game_mode(game_mode)
        if matches_ids:
            # Count how many matches already parsed in fullmatches_main tables
            tables_fullmatches_main = STT.get_tables(game, mode, C.MAIN)
            for t in tables_fullmatches_main:
                db_query = db.query(t.table.matchID.distinct())
                db_query = db_query.filter(t.table.matchID.in_(matches_ids))
                matches_stats[C.FULLMATCHES] += db_query.count()

    return matches_stats


def player_matches_stats_update(
    db: Session, uno: str, game_mode: GameMode
) -> MatchesStats | Error:
    games: GamesStatus | None = redis_manage(
        f'{C.PLAYER}:{C.UNO}_{uno}', 'hget', C.GAMES
    )

    if not games:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{uno}] {C.NOT_FOUND}')

    if game_mode == C.ALL:
        for game_mode in SGM.modes():
            games[game_mode][C.MATCHES][C.STATS] = matches_stats_game_mode_count(
                db, uno, game_mode
            )
    else:
        games[game_mode][C.MATCHES][C.STATS] = matches_stats_game_mode_count(
            db, uno, game_mode
        )

    set_games(db, uno, games)

    return games[game_mode][C.MATCHES][C.STATS]


def task_queues_delete(db: Session, task_name: str) -> Message | Error:
    task_queues = redis_manage(C.TASK_QUEUES, 'lrange')

    if task_name not in [task[C.NAME] for task in task_queues]:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'[{task_name}] {C.NOT_FOUND} in {C.TASK_QUEUES}',
        )

    for task in task_queues:
        if task[C.NAME] == task_name:
            redis_manage(C.TASK_QUEUES, 'lrem', task)
            task[C.STATUS] = STask.DELETED
            task[C.DATA][C.SOURCE] = task_queues_delete.__name__
            in_logs_queues(db, task)
            break

    return {C.MESSAGE: f'[{task_name}] {C.DELETED} from {C.TASK_QUEUES}'}


def images_get() -> ImageGameMaps:
    directory = Path.cwd().parent / C.STATIC / C.MAP
    game_maps: ImageGameMaps = {}

    for game_mode in SGM.modes():
        game_maps[game_mode] = []
        map_folders = directory / game_mode
        for map_folder in map_folders.iterdir():
            image_game_map: ImageGameMap = {
                C.NAME: map_folder.name,
                C.TIME: map_folder.stat().st_mtime,
            }
            game_maps[game_mode].append(image_game_map)

        game_maps[game_mode].sort(key=lambda _map: _map[C.TIME], reverse=True)

    return game_maps


def images_count_get() -> int:
    directory = Path.cwd().parent / C.STATIC / C.MAP
    count = 0
    for game_mode in SGM.modes():
        map_folders = directory / game_mode
        count += len(list(map_folders.iterdir()))

    return count


def images_put(body: ImageData) -> Message | Error:
    map_folder = Path.cwd().parent / C.STATIC / C.MAP
    map_folder = map_folder / body.game_mode / body.name

    if map_folder.exists() is False:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'map {body.game_mode} [{body.name}] {C.NOT_FOUND}',
        )

    map_folder.rename(map_folder.parent / body.new_name)

    return {C.MESSAGE: f'{C.MAP} [{body.name}] renamed to [{body.new_name}]'}


def images_delete(body: ImageData) -> Message | Error:
    map_folder = Path.cwd().parent / C.STATIC / C.MAP
    map_folder = map_folder / body.game_mode / body.name

    if map_folder.exists() is False:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'map {body.game_mode} [{body.name}] {C.NOT_FOUND}',
        )
    shutil.rmtree(map_folder)
    return {C.MESSAGE: f'map [{body.name}] {C.DELETED}'}


async def images_upload(request: Request) -> ImageUpload:
    form_data = await request.form()
    if not form_data:
        return json_error(status.HTTP_422_UNPROCESSABLE_ENTITY, 'no images')

    files: list[ImageUploadFiles] = []
    FORMAT = 'webp'
    epoch = now(C.EPOCH)
    directory = Path.cwd().parent / C.STATIC / 'temp' / str(epoch)

    if directory.exists() is False:
        directory.mkdir()
    for map_name, value in form_data.items():
        map_directory = directory / map_name
        map_directory.mkdir()

        img_file = await value.read()
        full_image = Image.open(BytesIO(img_file))
        full_image_path = map_directory / f'full.{FORMAT}'
        full_image.save(full_image_path, FORMAT)

        # Cropp image for table row background
        width, height = full_image.size
        top = int((height / 2) - 50)
        bottom = height - top
        crop = (0, top, width, bottom)
        table_thumb_image = full_image.convert('RGB').crop(crop)
        table_thumb_image_path = map_directory / f'table_thumb.{FORMAT}'
        table_thumb_image.save(table_thumb_image_path, FORMAT)

        b64_full = BytesIO()
        full_image.save(b64_full, format=FORMAT)
        b64_full = base64.b64encode(b64_full.getvalue()).decode()

        b64_thumb = BytesIO()
        table_thumb_image.save(b64_thumb, format=FORMAT)
        b64_thumb = base64.b64encode(b64_thumb.getvalue()).decode()

        file: ImageUploadFiles = {
            C.NAME: map_name,
            'b64_thumb': b64_thumb,
            'b64_full': b64_full,
        }
        files.append(file)

    result: ImageUpload = {C.FILES: files, C.EPOCH: epoch}

    return result


def images_submit(body: ImageUploadSubmit) -> Message | Error:
    directory = Path.cwd().parent / C.STATIC
    move_from = directory / 'temp' / str(body.epoch)

    if move_from.exists() is False:
        return json_error(status.HTTP_404_NOT_FOUND, f'session {C.NOT_FOUND}')

    for name in body.images:
        map_folder = directory / C.MAP / body.game_mode / name

        if map_folder.exists():
            shutil.rmtree(map_folder)
        shutil.move((move_from / name), map_folder.parent)

    shutil.rmtree(move_from)

    return {C.MESSAGE: f'image added {body.game_mode}'}


def labels_count_get(db: Session):
    labels_count: dict[LabelType, int] = {
        label_type: db.query(table).count()
        for label_type, table in STT.label_tables.items()
    }
    return labels_count


def labels_get(db: Session, label_type: LabelType):
    table = STT.label_tables[label_type]
    labels: list[LabelsItem] = db.query(table).order_by(table.id.desc()).all()
    labels = list(map(to_dict, labels))

    return {'labels': labels}


def labels_put(db: Session, body: LabelsItem, label_type: LabelType):
    table = STT.label_tables[label_type]
    query = db.query(table).filter(table.name == body.name)
    label = query.first()

    if label is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.LABEL} [{body.name}] {C.NOT_FOUND}'
        )

    query.update({table.label: body.label, table.game_mode: body.game_mode})
    db.commit()

    label = to_dict(query.first())

    return label


def labels_post(db: Session, body: LabelsItem, label_type: LabelType):
    table = STT.label_tables[label_type]
    query = db.query(table).filter(table.name == body.name)
    label: LabelsItem | None = query.first()

    if label:
        return json_error(
            status.HTTP_302_FOUND, f'{C.LABEL} [{body.name}] {C.ALREADY_EXIST}'
        )

    label = table(
        id=get_last_id(db, table) + 1,
        name=body.name,
        label=body.label,
        game_mode=body.game_mode,
    )
    db.add(label)
    db.commit()
    db.refresh(label)

    return to_dict(label)


def labels_delete(db: Session, name: str, label_type: LabelType):
    table = STT.label_tables[label_type]
    label = db.query(table).filter(table.name == name).first()

    if label is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.LABEL} [{name}] {C.NOT_FOUND}'
        )

    res = to_dict(label)

    db.delete(label)
    db.commit()

    set_table_sequence(db, table.__tablename__)

    return res


def labels_delete_all(db: Session, label_type: LabelType):
    table = STT.label_tables[label_type]
    deleted_labels = db.query(table).delete()
    db.commit()
    set_table_sequence(db, table.__tablename__, 0)

    return {C.MESSAGE: f'[{label_type}] {C.DELETED} labels - {deleted_labels}'}
