# pylint: disable=redefined-outer-name
import time
import copy
import csv
from pathlib import Path
import pytest

from fastapi import status
from sqlalchemy.orm import Session

from core.config import settings
from core.database import get_db

from apps.base.tests.store import TS
from apps.base.schemas.main import C, STaskStatus, Error
from apps.base.crud.utils import (
    in_logs,
    now,
    date_format,
    get_last_id,
    redis_manage,
)

from apps.tracker.crud.store_game_modes import SGM
from apps.tracker.crud.store_tables import STT
from apps.tracker.crud.get_game_data import GameData
from apps.tracker.crud.utils_data_init import GAMES_LIST, MATCHES_STATS
from apps.tracker.crud.main import (
    fullmatches_delete,
    fullmatches_pars_pack,
    match_get,
    labels_delete_all,
    labels_post,
    player_delete,
    player_matches_delete,
    player_matches_update,
    stats_add_summary_all_modes,
)
from apps.tracker.crud.utils import (
    add_to_task_queues,
    game_stats_format,
    target_unos_get,
    players_cache_update,
)
from apps.tracker.schemas.main import (
    SC,
    SGame,
    ClearFullmatchDoublesBody,
    FixtureMatches,
    FullmatchData,
    MatchData,
    Player,
    SearchResp,
    PlayerSearch,
    MatchBody,
    PlayerData,
    GroupData,
    StatsRouter,
    TargetGameMode,
    AllPlayers,
    MatchesStats,
    GameStats,
    Router,
    PlayerAdd,
    PlayerPlatforms,
    FixturePlayers,
    LabelsItem,
    GameStatus,
    PlayerStatus,
    RouterOrder,
    GameMode,
    LabelType,
    UpdateRouter,
    SPlayerParsed,
)


@pytest.fixture(scope='session')
def f_label():
    '''fixture: Test labels'''

    label = LabelsItem(
        id=-1,
        name=f'test_{C.LABEL}',
        label=f'test_{C.LABEL}',
        translate=None,
        game_mode=C.MW_MP,
        time=now(C.ISO),
    )
    label_type: LabelType = 'tactical'

    with next(get_db()) as db:
        # delete and recreate test label
        labels_delete_all(db, label_type)
        label = labels_post(db, label, label_type)
        label[C.TIME] = date_format(label[C.TIME], C.ISO)

    return label, label_type


@pytest.fixture(scope='session')
def f_players():
    '''fixture: Test players'''

    players: list[PlayerPlatforms] = [
        {
            C.ACTI: 'TabunEjat#1566968',
            C.BATTLE: 'TabunEjat#2749',
            C.UNO: '15124111181840200037',
        },
        {
            C.ACTI: 'ReidboyyOnTwitch#1685432',
            C.BATTLE: None,
            C.UNO: '12927459638873238665',
        },
        {
            C.ACTI: None,
            C.BATTLE: 'KontrLValleT#2550',
            C.UNO: '9765242718478189799',
        },
        {
            C.ACTI: 'og quokka#9875647',
            C.BATTLE: None,
            C.UNO: '15008780070350970350',
        },
        {C.ACTI: None, C.BATTLE: 'Newbz#11184', C.UNO: '4141297667422051906'},
        {C.ACTI: None, C.BATTLE: None, C.UNO: '9052265328277523774'},
    ]

    search_bodys: dict[str, PlayerSearch] = {}
    for player in players:
        for platform in SC.PLATFORMS[::-1]:
            if not player[platform] or player[C.UNO] in search_bodys:
                continue
            search_bodys[player[C.UNO]] = {
                C.PLATFORM: platform,
                C.TARGET: player[platform],
                C.UNO: player[C.UNO],
            }

    with next(get_db()) as db:
        # clean test players
        for player in players:
            player_delete(db, player[C.UNO])
            player_matches_delete(db, player[C.UNO], C.ALL)
        player: PlayerData = player_add_test(db, players[0])

    group: GroupData = redis_manage(
        f'{C.GROUP}:{C.UNO}_{settings.TEST_GROUP}', 'hgetall'
    )

    return FixturePlayers(
        player=player,
        group=group,
        search_bodys=list(search_bodys.values()),
    )


@pytest.fixture(scope='session')
def f_matches():
    '''fixture: Exist matches targets for test'''

    fullmatches: dict[GameMode, list[FullmatchData]] = {
        C.MW_MP: [
            {C.MATCHID: '1232261896371516498', C.YEAR: '2020', C.MAP: 'mp_boneyard_gw'}
        ],
        C.MW_WZ: [
            {C.MATCHID: '6064346156737486888', C.YEAR: '2022', C.MAP: 'mp_wz_island'}
        ],
    }
    match_bodys: list[MatchBody] = []

    targets: dict[GameMode, dict[str, set]] = {
        C.MW_MP: {C.UNO: set(), C.USERNAME: set(), C.CLANTAG: set(), C.DATE: set()},
        C.MW_WZ: {C.UNO: set(), C.USERNAME: set(), C.CLANTAG: set(), C.DATE: set()},
    }

    with next(get_db()) as db:
        for game_mode in SGM.modes():
            table = STT.get_table(game_mode, C.MATCHES).table
            matches = db.query(table).limit(5).all()
            for match in matches:
                match_bodys.append(
                    {
                        C.GAME_MODE: game_mode,
                        'match_id': match.id,
                        C.SOURCE: C.MATCHES,
                        C.YEAR: str(match.time.year),
                    }
                )

        for game_mode, pars_list in fullmatches.items():
            # clear fullmatches
            for pars in pars_list:
                fullmatches_delete(db, pars[C.MATCHID], game_mode, pars[C.YEAR])
            # pars fullmatches
            is_parsed = fullmatches_pars_pack(db, pars_list, game_mode)
            if not is_parsed:
                in_logs(
                    f_matches.__name__,
                    game_mode,
                    'cod_logs',
                    {'pars_list': pars_list},
                )
                assert False

            for match_meta in pars_list:
                match = match_get(db, match_meta[C.MATCHID], game_mode)
                date = date_format(match[C.TIME], C.DATE)
                targets[game_mode][C.DATE].add(date)
                for team in match[C.TEAM]:
                    for player in team[C.PLAYERS]:
                        for meta in targets[game_mode]:
                            if meta == C.DATE:
                                continue
                            if meta_data := player.get(meta):
                                targets[game_mode][meta].add(meta_data)

                    match_bodys.append(
                        {
                            C.GAME_MODE: game_mode,
                            'match_id': team[C.PLAYERS][0][C.ID],
                            C.SOURCE: C.MAIN,
                            C.YEAR: match_meta[C.YEAR],
                        }
                    )

    res: FixtureMatches = {
        C.FULLMATCHES: fullmatches,
        'match_bodys': match_bodys,
        'targets': targets,
    }

    return res


def player_add_test(db: Session, player: PlayerPlatforms):
    games: dict[GameMode, int] = {C.ALL: 0}
    games_stats = {}

    for game_mode in SGM.modes():
        slugs = (player[C.BATTLE], game_mode, C.MATCHES, C.BATTLE, 0)
        matches_data = GameData.get(slugs, 0)
        games[game_mode] = SGame.ENABLED if matches_data else SGame.NOT_ENABLED

    for game in GAMES_LIST:
        slugs = (player[C.BATTLE], f'{game}_{C.MP}', C.STATS, C.BATTLE, 0)
        stats_data = GameData.get(slugs, 0)
        if stats_data is None or stats_data.get('title') is None:
            continue
        games_stats[game] = game_stats_format(stats_data['lifetime'], game)

    log: GameStatus = {
        C.UNO: player[C.UNO],
        C.GAME_MODE: C.MW_MP,
        'records': 0,
        C.SOURCE: player_add_test.__name__,
        C.TIME: now(C.ISO),
    }

    db.add(
        STT.players(
            id=get_last_id(db, STT.players) + 1,
            uno=player[C.UNO],
            acti=player[C.ACTI],
            battle=player[C.BATTLE],
            username=[player[C.ACTI].split('#', maxsplit=1)[0]],
            clantag=['test'],
            group=settings.TEST_GROUP,
            games={
                game_mode: {
                    C.STATUS: status,
                    C.MATCHES: {
                        C.STATS: MATCHES_STATS.copy(),
                        C.LOGS: [
                            (
                                (log | {C.GAME_MODE: game_mode})
                                if game_mode != C.ALL
                                else log
                            )
                        ],
                    },
                    C.STATS: {
                        C.LOGS: [
                            (
                                (log | {C.GAME_MODE: game_mode})
                                if game_mode != C.ALL
                                else log
                            )
                        ]
                    },
                }
                for game_mode, status in games.items()
            },
            games_stats=stats_add_summary_all_modes(games_stats),
        )
    )
    db.commit()
    players_cache_update(db)
    player: PlayerData = redis_manage(f'{C.PLAYER}:{C.UNO}_{player[C.UNO]}', 'hgetall')

    for game_mode, game_status in player[C.GAMES].items():
        if game_mode != C.ALL and game_status[C.STATUS] != 0:
            player_matches_update(db, player[C.UNO], game_mode, C.MATCHES_HISTORY)

    return player


def test_player_search(f_players: FixturePlayers):
    TS.set_role_token(C.GUEST)

    search_bodys: list[PlayerSearch] = [
        {
            C.PLATFORM: C.SEARCH,
            C.TARGET: search_body.target.split('#', maxsplit=1)[0],
            C.UNO: search_body.uno,
        }
        for search_body in f_players.search_bodys[:2]
    ]

    for search_body in search_bodys:
        responses: list[SearchResp] = []

        with TS.client.websocket_connect(
            f'{TS.FASTAPI_API_PATH}/ws/player_search'
        ) as ws:
            ws.send_json(search_body)
            resp: SearchResp = ws.receive_json()
            responses.append(resp)

        assert responses


def test_player_add(f_players: FixturePlayers):
    TS.set_role_token(C.GUEST)

    # check if already added player
    search_body = f_players.search_bodys.pop(0).model_dump()
    username: list[str] | None = redis_manage(
        f'{C.PLAYER}:{C.UNO}_{search_body[C.UNO]}', 'hget', C.USERNAME
    )
    assert username

    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/player_pre_check', json=search_body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_player_add.__name__,
        (C.MESSAGE, f'[{username[0]}] {C.ALREADY_EXIST}'),
        search_body,
    )

    for search_body in f_players.search_bodys:
        search_body = search_body.model_dump()
        resp = TS.client.post(
            f'{TS.FASTAPI_API_PATH}/player_pre_check', json=search_body
        )
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_player_add.__name__,
            (C.MESSAGE, 'found'),
            search_body,
        )
        result: SearchResp = resp.json()
        player: Player = result[C.RESULT]

        if not player[C.USERNAME]:
            in_logs(
                test_player_add.__name__,
                f'{TS.FASTAPI_API_PATH}/player_pre_check',
                {'resp': resp, 'search_body': search_body},
            )
            assert False
        assert search_body[C.UNO] == player[C.UNO]

        player_add_body: PlayerAdd = {
            C.UNO: player[C.UNO],
            C.GROUP: f_players.group.uno,
        }

        resp = TS.client.post(
            f'{TS.FASTAPI_API_PATH}/player_add/', json=player_add_body
        )
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_player_add.__name__,
            (C.MESSAGE, f'{C.PLAYER} [{player[C.USERNAME][0]}] successfully added'),
        )

        group = redis_manage(
            f'{C.PLAYER}:{C.UNO}_{player_add_body[C.UNO]}', 'hget', C.GROUP
        )
        assert player_add_body[C.GROUP] == group


def test_players_get():
    TS.set_role_token(C.GUEST)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/players')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_players_get.__name__,
        (C.DETAIL, f'{C.GUEST} {C.TOKEN}'),
    )

    TS.set_role_token(C.USER)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/players')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_players_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/players')
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_players_get.__name__,
    )
    result: AllPlayers | Error = resp.json()
    assert isinstance(result.get(C.PLAYERS), list)


def test_task_queues_delete():
    # Delete non exist queue
    name = TS.NON_EXIST_NAME
    TS.set_role_token(C.USER)
    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/task_queues/{name}')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_task_queues_delete.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/task_queues/{name}')
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_task_queues_delete.__name__,
        (C.DETAIL, f'[{name}] {C.NOT_FOUND} in {C.TASK_QUEUES}'),
    )

    uno = 'test'
    game_mode = C.MW_MP
    data_type = C.MATCHES

    task_status = add_to_task_queues(uno, game_mode, data_type)
    assert task_status in (STaskStatus.STARTED, STaskStatus.ADDED)

    task_name = f'{uno} {game_mode} {data_type}'
    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/task_queues/{task_name}')
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_task_queues_delete.__name__,
        (C.MESSAGE, f'[{task_name}] {C.DELETED} from {C.TASK_QUEUES}'),
    )


def test_update_router():
    TS.set_role_token(C.GUEST)
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/update_router', json={})
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_update_router.__name__,
        (C.DETAIL, f'{C.GUEST} {C.TOKEN}'),
    )

    TS.set_role_token(C.USER)

    players = redis_manage(
        f'{C.GROUP}:{C.UNO}_{settings.TEST_GROUP}', 'hget', C.PLAYERS
    )

    for player in players.values():
        username = player[C.USERNAME][0]

        for game_mode in SGM.modes():
            body: UpdateRouter = {
                C.DATA_TYPE: C.MATCHES,
                C.UNO: player[C.UNO],
                C.GAME_MODE: game_mode,
            }
            # regular pars matches for not enabled player
            resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/update_router', json=body)

            player_status: PlayerStatus = player[C.GAMES][C.ALL][C.STATUS]
            game_status = player[C.GAMES][game_mode][C.STATUS]  # SGame

            if player_status == SPlayerParsed.NONE:
                expected = (C.DETAIL, f'[{username}] {C.PLAYER} not {C.ENABLED}')
            elif game_status == SGame.NOT_ENABLED:
                expected = (C.DETAIL, f'[{username}] {game_mode} not {C.ENABLED}')
            elif game_status == SGame.DISABLED:
                expected = (C.DETAIL, f'[{username}] {game_mode} {C.DISABLED}')
            else:
                # player was fresh created and need wait delay between check new matches
                expected = (C.MESSAGE, 'please wait')

            TS.check_response(
                resp,
                (status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED),
                test_update_router.__name__,
                expected,
                body,
            )

            # pars matches history for not enabled player
            body[C.DATA_TYPE] = C.MATCHES_HISTORY
            resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/update_router', json=body)
            if player_status != SPlayerParsed.NONE:
                expected = (C.DETAIL, f'{C.MATCHES} [{username}] already parsed')
            elif game_status == SGame.NOT_ENABLED:
                expected = (C.DETAIL, f'[{username}] {game_mode} not {C.ENABLED}')
            else:
                expected = None

            TS.check_response(
                resp,
                (status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED),
                test_update_router.__name__,
                expected,
                {
                    'game_mode': game_mode,
                    C.UNO: player[C.UNO],
                },
            )

            body[C.DATA_TYPE] = C.STATS
            resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/update_router', json=body)

            if game_status == SGame.NOT_ENABLED:
                expected = (C.DETAIL, f'[{username}] {game_mode} not {C.ENABLED}')
            elif game_status == SGame.DISABLED:
                expected = (C.DETAIL, f'[{username}] {game_mode} {C.DISABLED}')
            else:
                weeks = int(settings.STATS_INTERVAL_WEEKS.days / 7)
                expected = (
                    C.DETAIL,
                    f'{C.TIME} interval between updates [{weeks}] weeks',
                )

            TS.check_response(
                resp,
                status.HTTP_405_METHOD_NOT_ALLOWED,
                test_update_router.__name__,
                expected,
                body,
            )

        # body: UpdateRouter = {
        #     C.DATA_TYPE: C.ALL,
        #     C.TARGET: player[C.UNO],
        #     C.GAME_MODE: C.ALL,
        # }
        # resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/update_router', json=body)
        # TS.check_response(
        #     resp,
        #     status.HTTP_200_OK,
        #     test_update_router.__name__,
        #     (C.MESSAGE, f'{C.STATS} and {C.MATCHES} start update'),
        # )


# def player_put(body: EditTarget, res_status: int, message: str):
#     # EditPlayerResponse
#     resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/players', json=body)
#     TS.check_response(
#         resp,
#         res_status,
#         player_put.__name__,
#         (C.MESSAGE if res_status == status.HTTP_200_OK else C.DETAIL, message),
#         body,
#     )


# def test_player_put(f_players: FixturePlayers):
#     body: EditTarget = {C.TARGET: '-1', C.NAME: TS.NON_EXIST_NAME, C.VALUE: 0}

#     TS.set_role_token(C.GUEST)
#     player_put(body, status.HTTP_401_UNAUTHORIZED, f'{C.GUEST} {C.TOKEN}')

#     TS.set_role_token(C.ADMIN)

#     player_put(body, status.HTTP_404_NOT_FOUND, f'[{body[C.TARGET]}] {C.NOT_FOUND}')

#     body[C.TARGET] = f_players.player.uno
#     player_put(body, status.HTTP_405_METHOD_NOT_ALLOWED, f'{body[C.NAME]} not allowed')

#     # change to already used id
#     body[C.NAME] = C.ID

#     unos = target_unos_get(C.PLAYER)
#     for uno in unos:
#         if uno != f_players.player.uno:
#             with next(get_db()) as db:
#                 player: PlayerBasic | None = player_get(
#                     db, uno, C.BASIC, test_player_put.__name__
#                 )
#                 if player is None:
#                     in_logs(
#                         test_player_put.__name__,
#                         f'{uno} {C.NOT_FOUND}',
#                         'logs',
#                         {
#                             'body': body,
#                             'unos': unos,
#                             'f_players.player.uno': f_players.player.uno,
#                         },
#                     )
#                     assert False
#                 body[C.VALUE] = player[C.ID]
#                 player_put(body, status.HTTP_302_FOUND, f'used by [{uno}]')
#                 break

#     body[C.NAME] = C.ALL
#     new_player_status = f_players.player.games.all.status + 1
#     player_put(
#         body,
#         status.HTTP_200_OK,
#         f'{C.PLAYER} {C.STATUS} changed to {new_player_status}',
#     )
#     f_players.player.games.all.status = new_player_status

#     body[C.NAME] = C.MW_WZ
#     new_game_status = f_players.player.games.mw_wz.status + 1
#     player_put(
#         body,
#         status.HTTP_200_OK,
#         f'{C.GAME} {body[C.NAME]} {C.STATUS} changed to {new_game_status}',
#     )
#     f_players.player.games.mw_wz.status = new_game_status

#     body[C.NAME] = C.GAMES
#     f_players.player.games.mw_mp.matches.stats.played += 1
#     body[C.VALUE] = f_players.player.games.model_dump()
#     player_put(body, status.HTTP_200_OK, 'saved')

#     body[C.NAME] = C.GROUP

#     body[C.VALUE] = 's'
#     player_put(
#         body,
#         status.HTTP_405_METHOD_NOT_ALLOWED,
#         f'{body[C.NAME]} {C.NAME} {body[C.VALUE]} too short',
#     )

#     body[C.VALUE] *= 18
#     player_put(
#         body,
#         status.HTTP_405_METHOD_NOT_ALLOWED,
#         f'{body[C.NAME]} {C.NAME} {body[C.VALUE]} too long',
#     )

#     body[C.VALUE] = TS.NON_EXIST_ID
#     player_put(
#         body,
#         status.HTTP_405_METHOD_NOT_ALLOWED,
#         f'{body[C.NAME]} {C.NAME} can\'t be a number [{TS.NON_EXIST_ID}]',
#     )
#     body[C.VALUE] = [str(TS.NON_EXIST_ID)]
#     player_put(
#         body,
#         status.HTTP_405_METHOD_NOT_ALLOWED,
#         f'{body[C.NAME]} {C.NAME} {C.NOT_VALID}',
#     )

#     body[C.NAME] = C.TIME
#     body[C.VALUE] = now(C.EPOCH)
#     player_put(
#         body,
#         status.HTTP_200_OK,
#         f'{body[C.NAME]} changed to {date_format(body[C.VALUE], C.DATETIME)}',
#     )


def test_player_add_game_mode(f_players: FixturePlayers):
    TS.set_role_token(C.GUEST)

    body: TargetGameMode = {C.TARGET: f_players.player.uno, C.GAME_MODE: C.MW_WZ}
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/players/add_game_mode', json=body)
    TS.check_response(
        resp, status.HTTP_401_UNAUTHORIZED, test_player_add_game_mode.__name__
    )

    TS.set_role_token(C.ADMIN)

    for game_mode in SGM.modes():
        info = f'{game_mode} [{f_players.player.username[0]}]'
        body[C.GAME_MODE] = game_mode

        resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/players/add_game_mode', json=body)

        games = f_players.player.games.model_dump()

        if games[game_mode][C.STATUS] != 0:
            TS.check_response(
                resp,
                status.HTTP_302_FOUND,
                test_player_add_game_mode.__name__,
                (C.DETAIL, f'{info} already {C.ENABLED}'),
            )
        elif resp.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            TS.check_response(
                resp,
                status.HTTP_405_METHOD_NOT_ALLOWED,
                test_player_add_game_mode.__name__,
                (C.DETAIL, f'{info} not available'),
            )
        else:
            TS.check_response(
                resp,
                status.HTTP_200_OK,
                test_player_add_game_mode.__name__,
                (C.MESSAGE, f'create {info} [{f_players.player.group}] started'),
            )


def test_player_clear_match_doubles(f_players: FixturePlayers):
    TS.set_role_token(C.ADMIN)
    for game_mode in SGM.modes():
        body: TargetGameMode = {
            C.TARGET: f_players.player.uno,
            C.GAME_MODE: game_mode,
        }
        resp = TS.client.post(
            f'{TS.FASTAPI_API_PATH}/player_clear_match_doubles', json=body
        )
        doubles_found = 0
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_player_clear_match_doubles.__name__,
            (C.MESSAGE, f'{game_mode} {C.DELETED} [{doubles_found}] doubles'),
        )


def test_player_matches_stats_update(f_players: FixturePlayers):
    body: TargetGameMode = {C.TARGET: str(TS.NON_EXIST_ID), C.GAME_MODE: C.MW_WZ}

    TS.set_role_token(C.GUEST)
    resp = TS.client.post(
        f'{TS.FASTAPI_API_PATH}/player_matches_stats_update', json=body
    )
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_player_matches_stats_update.__name__,
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.post(
        f'{TS.FASTAPI_API_PATH}/player_matches_stats_update', json=body
    )
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_player_matches_stats_update.__name__,
        (C.DETAIL, f'[{body[C.TARGET]}] {C.NOT_FOUND}'),
    )

    body[C.TARGET] = f_players.player.uno

    for game_mode in SGM.modes():
        body[C.GAME_MODE] = game_mode
        resp = TS.client.post(
            f'{TS.FASTAPI_API_PATH}/player_matches_stats_update', json=body
        )
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_player_matches_stats_update.__name__,
            None,
            body,
        )
        MatchesStats.model_validate(resp.json())


def test_matches_router(f_players: FixturePlayers, f_matches: FixtureMatches):
    # wait until all pars matches tasks will be done
    time_passed = 0
    INTERVAL = int(settings.TASK_QUEUES_INTERVAL_SECONDS.total_seconds())
    while tasks := redis_manage(C.TASK_QUEUES, 'llen'):
        time_passed += INTERVAL
        if time_passed > INTERVAL * 10:
            assert False
        print(f'await {time_passed=} {tasks=}')
        time.sleep(INTERVAL)

    body: Router = {
        C.DATA_TYPE: C.UNO,
        C.TARGET: C.TRACKER,
        C.GAME: C.ALL,
        C.MODE: C.ALL,
        C.GAME_MODE: C.ALL,
        C.ORDER: '-time',
        C.PAGE: 0,
        C.DATE: '',
    }
    targets = (
        f_players.player.uno,
        f_players.group.uno,
        C.ALL,
        str(TS.NON_EXIST_ID),
    )
    orders: list[RouterOrder] = [
        C.TIME,
        C.DURATION,
        C.KILLS,
        C.KDRATIO,
        TS.NON_EXIST_NAME,
    ]
    orders += [f'-{order}' for order in orders]

    bodys: list[Router] = []
    for game_mode, (game, mode) in SGM.modes(C.ALL, C.ALL).items():
        body[C.GAME] = game
        body[C.MODE] = mode
        body[C.GAME_MODE] = game_mode
        for target in targets:
            body[C.TARGET] = target
            for order in orders:
                body[C.ORDER] = order
                for page in range(1, 3):
                    body[C.PAGE] = page
                    bodys.append(body)

    games = f_players.player.games.model_dump()

    for body in bodys:
        resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/matches_router', json=body)

        if TS.NON_EXIST_NAME in body[C.ORDER]:
            TS.check_response(
                resp,
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                test_matches_router.__name__,
                None,
                body,
            )

        elif body[C.TARGET] == str(TS.NON_EXIST_ID):
            TS.check_response(
                resp,
                status.HTTP_404_NOT_FOUND,
                test_matches_router.__name__,
                (C.DETAIL, f'[{TS.NON_EXIST_ID}] {C.NOT_FOUND}'),
                body,
            )

        elif (
            body[C.TARGET] == f_players.player.uno
            and body[C.GAME_MODE] != C.ALL
            and games[body[C.GAME_MODE]][C.STATUS] == SGame.NOT_ENABLED
        ):
            TS.check_response(
                resp,
                status.HTTP_404_NOT_FOUND,
                test_matches_router.__name__,
                (
                    C.DETAIL,
                    f'{C.MATCHES} [{f_players.player.username[0]}] {C.NOT_FOUND}',
                ),
                body,
            )

        else:
            TS.check_response(
                resp, status.HTTP_200_OK, test_matches_router.__name__, None, body
            )

    body[C.ORDER] = C.TIME
    body[C.PAGE] = 1

    for game_mode, metas in f_matches['targets'].items():
        game, mode = SGM.desctruct_game_mode(game_mode)
        body[C.GAME] = game
        body[C.MODE] = mode
        body[C.GAME_MODE] = game_mode

        for meta, values in metas.items():
            assert values
            if meta == C.DATE:
                continue

            body[C.DATA_TYPE] = meta

            for value in values:
                body[C.TARGET] = value
                body[C.DATE] = ''
                resp = TS.client.post(
                    f'{TS.FASTAPI_API_PATH}/matches_router', json=body
                )
                TS.check_response(
                    resp,
                    status.HTTP_200_OK,
                    test_matches_router.__name__,
                    None,
                    body,
                )

                for date in metas[C.DATE]:
                    body[C.DATE] = date
                    resp = TS.client.post(
                        f'{TS.FASTAPI_API_PATH}/matches_router', json=body
                    )
                    TS.check_response(
                        resp,
                        status.HTTP_200_OK,
                        test_matches_router.__name__,
                        None,
                        body,
                    )


def test_match_get(f_matches: FixtureMatches):
    for game_mode in SGM.modes(C.MW):
        for match in f_matches[C.FULLMATCHES][game_mode]:
            resp = TS.client.get(
                f'{TS.FASTAPI_API_PATH}/match/{match[C.MATCHID]}/{game_mode}'
            )
            TS.check_response(resp, status.HTTP_200_OK, test_match_get.__name__)
            result: MatchData = resp.json()
            assert result[C.MAP][C.NAME] == match[C.MAP]

        # non exist
        resp = TS.client.get(
            f'{TS.FASTAPI_API_PATH}/match/{TS.NON_EXIST_ID}/{game_mode}'
        )
        TS.check_response(
            resp,
            status.HTTP_404_NOT_FOUND,
            test_match_get.__name__,
            (C.DETAIL, f'{C.MATCHID} [{TS.NON_EXIST_ID}] {C.NOT_FOUND}'),
        )


def test_match_stats_get(f_matches: FixtureMatches):
    body: MatchBody = {
        C.GAME_MODE: C.MW_WZ,
        'match_id': TS.NON_EXIST_ID,
        C.SOURCE: TS.NON_EXIST_NAME,
        C.YEAR: '2022',
    }

    # non exist source
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/match_stats', json=body)
    TS.check_response(
        resp, status.HTTP_422_UNPROCESSABLE_ENTITY, test_match_stats_get.__name__
    )

    # non exist match id
    body[C.SOURCE] = C.MATCHES
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/match_stats', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_match_stats_get.__name__,
        (C.DETAIL, f'[{TS.NON_EXIST_ID}] {C.NOT_FOUND}'),
    )

    for match_body in f_matches['match_bodys']:
        resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/match_stats', json=match_body)
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_match_stats_get.__name__,
            (C.ID, match_body['match_id']),
            match_body,
        )


def test_clear_fullmatches_doubles(f_matches: FixtureMatches):
    body: ClearFullmatchDoublesBody = {
        C.GAME_MODE: C.MW_WZ,
        C.MATCHID: str(TS.NON_EXIST_ID),
    }

    TS.set_role_token(C.GUEST)
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/clear_fullmatches_doubles', json=body)
    TS.check_response(
        resp, status.HTTP_401_UNAUTHORIZED, test_clear_fullmatches_doubles.__name__
    )

    TS.set_role_token(C.ADMIN)
    for game_mode in SGM.modes(C.MW):
        body[C.GAME_MODE] = game_mode
        # non exist MATCHID
        resp = TS.client.post(
            f'{TS.FASTAPI_API_PATH}/clear_fullmatches_doubles', json=body
        )
        TS.check_response(
            resp,
            status.HTTP_404_NOT_FOUND,
            test_clear_fullmatches_doubles.__name__,
            (C.DETAIL, f'[{body[C.MATCHID]}] {game_mode} {C.NOT_FOUND}'),
        )

        for match in f_matches[C.FULLMATCHES][game_mode]:
            body[C.MATCHID] = match[C.MATCHID]
            resp = TS.client.post(
                f'{TS.FASTAPI_API_PATH}/clear_fullmatches_doubles', json=body
            )
            TS.check_response(
                resp,
                status.HTTP_404_NOT_FOUND,
                test_clear_fullmatches_doubles.__name__,
                (C.DETAIL, f'[{body[C.MATCHID]}] {game_mode} doubles {C.NOT_FOUND}'),
            )


def test_player_matches_history_pars(f_players: FixturePlayers):
    TS.set_role_token(C.GUEST)
    resp = TS.client.get(
        f'{TS.FASTAPI_API_PATH}/player_matches_history_pars/{TS.NON_EXIST_ID}'
    )
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_player_matches_history_pars.__name__,
    )

    TS.set_role_token(C.USER)

    # non exist
    resp = TS.client.get(
        f'{TS.FASTAPI_API_PATH}/player_matches_history_pars/{TS.NON_EXIST_ID}'
    )
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_player_matches_history_pars.__name__,
        (C.DETAIL, f'[{TS.NON_EXIST_ID}] {C.NOT_FOUND}'),
    )

    uno = f_players.player.uno
    username = f_players.player.username[0]

    # # player with status 1
    # resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/player_matches_history_pars/{uno}')
    # TS.check_response(
    #     resp,
    #     status.HTTP_405_METHOD_NOT_ALLOWED,
    #     test_player_matches_history_pars.__name__,
    #     (C.DETAIL, f'{C.MATCHES} [{username}] already parsed'),
    # )

    # player with status 0
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/player_matches_history_pars/{uno}')

    if f_players.player.games.all.status > SPlayerParsed.NONE:
        TS.check_response(
            resp,
            status.HTTP_302_FOUND,
            test_player_matches_history_pars.__name__,
            (
                C.DETAIL,
                f'{C.MATCHES} [{username}] already parsed',
            ),
        )
    else:
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_player_matches_history_pars.__name__,
            (
                C.MESSAGE,
                f'pars {C.MATCHES} [{username}] started',
            ),
        )


def test_stats_router(f_players: FixturePlayers):
    body: StatsRouter = {
        C.UNO: TS.NON_EXIST_NAME,
        C.GAME: C.ALL,
    }

    # non exist target
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/stats_router', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_stats_router.__name__,
        (C.DETAIL, f'[{TS.NON_EXIST_NAME}] {C.NOT_FOUND}'),
        body,
    )

    # non exist player id
    body[C.UNO] = str(TS.NON_EXIST_ID)
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/stats_router', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_stats_router.__name__,
        (C.DETAIL, f'{C.PLAYER} {C.UNO} [{body[C.UNO]}] {C.NOT_FOUND}'),
        body,
    )

    body[C.UNO] = C.TRACKER
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/stats_router', json=body)
    TS.check_response(resp, status.HTTP_200_OK, test_stats_router.__name__, None, body)

    body[C.UNO] = f_players.player.uno
    games = f_players.player.games.model_dump()

    for game_mode, (game,) in SGM.modes(C.ALL, C.ALL).items():
        body[C.GAME] = game
        resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/stats_router', json=body)
        if game_mode != C.ALL and games[game_mode][C.STATUS] == SGame.NOT_ENABLED:
            TS.check_response(
                resp,
                status.HTTP_405_METHOD_NOT_ALLOWED,
                test_stats_router.__name__,
                (
                    C.DETAIL,
                    f'[{f_players.player.username[0]}] {game_mode} not {C.ENABLED}',
                ),
                body,
            )
        else:
            TS.check_response(
                resp, status.HTTP_200_OK, test_stats_router.__name__, None, body
            )
            result: GameStats = resp.json()
            assert result.get(C.ALL)

    for uno in target_unos_get(C.GROUP):
        body[C.UNO] = uno
        for (game,) in SGM.modes(C.ALL, C.ALL).values():
            body[C.GAME] = game
            resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/stats_router', json=body)
            TS.check_response(
                resp,
                (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND),
                test_stats_router.__name__,
                None,
                body,
            )


def test_reset():
    TS.set_role_token(C.GUEST)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/reset/{TS.NON_EXIST_NAME}')
    TS.check_response(resp, status.HTTP_401_UNAUTHORIZED, test_reset.__name__)

    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/reset/{TS.NON_EXIST_NAME}')
    TS.check_response(resp, status.HTTP_422_UNPROCESSABLE_ENTITY, test_reset.__name__)

    status_resets = (C.STATUS, C.AUTO_UPDATE)
    resets = (
        C.PLAYERS,
        C.CHART,
        C.LOADOUT,
        'matches_stats',
        'base_stats',
        'tracker_stats',
        'clear_players_match_doubles',
    )
    resets += status_resets

    # On deploy server
    # resets += ('reboot', 'shutdown')

    for reset in resets:
        # ResetResponse
        resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/reset/{reset}')
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_reset.__name__,
        )

    # Set back statuses
    for reset in status_resets:
        resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/reset/{reset}')
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_reset.__name__,
        )


def test_player_delete(f_players: FixturePlayers):
    uno = TS.NON_EXIST_ID
    # resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/players/{uno}')
    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/players/{uno}')
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_player_delete.__name__,
        (C.DETAIL, f'[{uno}] {C.NOT_FOUND}'),
    )

    uno = f_players.player.uno
    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/players/{uno}')
    # resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/players/{uno}')
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_player_delete.__name__,
        (C.MESSAGE, f'{C.PLAYER} {C.DELETED} [{f_players.player.username[0]}]'),
    )


def test_labels_get():
    label_types = LabelType.__args__
    TS.set_role_token(C.GUEST)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/labels/{label_types[0]}')
    TS.check_response(resp, status.HTTP_401_UNAUTHORIZED, test_labels_get.__name__)

    TS.set_role_token(C.ADMIN)
    for label_type in label_types:
        resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/labels/{label_type}')
        TS.check_response(resp, status.HTTP_200_OK, test_labels_get.__name__)


def test_labels_put(f_label: tuple[LabelsItem, LabelType]):
    TS.set_role_token(C.ADMIN)

    body = copy.copy(f_label[0])
    label_type = f_label[1]

    body[C.LABEL] *= 11
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        test_labels_put.__name__,
        (C.DETAIL, f'{C.LABEL} length limit {settings.NAME_LIMIT_2}'),
        body,
    )

    body[C.LABEL] = '  '
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp, status.HTTP_200_OK, test_labels_put.__name__, (C.LABEL, None), body
    )

    body[C.LABEL] = f'valid {C.LABEL}'
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_labels_put.__name__,
        (C.LABEL, body[C.LABEL]),
        body,
    )

    body[C.NAME] = TS.NON_EXIST_NAME
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_labels_put.__name__,
        (C.DETAIL, f'{C.LABEL} [{body[C.NAME]}] {C.NOT_FOUND}'),
        body,
    )


def test_labels_post(f_label: tuple[LabelsItem, LabelType]):
    TS.set_role_token(C.ADMIN)

    body = copy.copy(f_label[0])
    label_type = f_label[1]

    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_labels_post.__name__,
        (C.DETAIL, f'{C.LABEL} [{body[C.NAME]}] {C.ALREADY_EXIST}'),
        body | {'label_type': label_type},
    )

    body[C.NAME] *= 2
    body[C.LABEL] = None
    body[C.TIME] = now(C.ISO)

    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_labels_post.__name__,
        (C.NAME, body[C.NAME]),
        body | {'label_type': label_type},
    )

    body[C.NAME] *= 5
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        test_labels_post.__name__,
        (C.DETAIL, f'{C.NAME} length limit {settings.NAME_LIMIT_2}'),
        body | {'label_type': label_type},
    )

    body[C.NAME] = '  '
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        test_labels_post.__name__,
        (C.DETAIL, f'{C.NAME} required'),
        body | {'label_type': label_type},
    )

    body[C.GAME_MODE] = TS.NON_EXIST_NAME
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/labels/{label_type}', json=body)
    TS.check_response(
        resp, status.HTTP_422_UNPROCESSABLE_ENTITY, test_labels_post.__name__
    )


def test_labels_delete(f_label: tuple[LabelsItem, LabelType]):
    TS.set_role_token(C.ADMIN)

    body = copy.copy(f_label[0])
    label_type = f_label[1]

    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/labels/{label_type}/{body[C.NAME]}')
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_labels_delete.__name__,
        (C.NAME, body[C.NAME]),
        body,
    )

    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/labels/{label_type}/{body[C.NAME]}')
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_labels_delete.__name__,
        (C.DETAIL, f'{C.LABEL} [{body[C.NAME]}] {C.NOT_FOUND}'),
        body,
    )


def test_labels_delete_all(f_label: tuple[LabelsItem, LabelType]):
    TS.set_role_token(C.ADMIN)

    label_type = f_label[1]

    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/labels/{label_type}')
    TS.check_response(resp, status.HTTP_200_OK, test_labels_delete_all.__name__)

    # restore labels in table
    file_path = Path.cwd().parent / C.STATIC / C.FILES / f'cod_label_{label_type}.csv'
    with open(file_path, 'r', encoding='utf8') as file:
        labels = csv.DictReader(file)
        for label_dict in labels:
            label = LabelsItem.model_validate(label_dict)
            with next(get_db()) as db:
                labels_post(db, label, label_type)
