import datetime

from apps.base.schemas.main import C
from apps.tracker.schemas.main import (
    GamesStatus,
    MatchesStats,
    Player,
    GameStatusLog,
    GameMode,
    Game,
    Mode,
)

GAME_MODES: dict[GameMode, tuple[Game, Mode]] = {
    C.MW_MP: (C.MW, C.MP),
    C.MW_WZ: (C.MW, C.WZ),
    C.CW_MP: (C.CW, C.MP),
    C.VG_MP: (C.VG, C.MP),
    C.ALL: (C.ALL, C.ALL),
}
GAME_MODE_LIST = list(GAME_MODES.keys())
GAMES_LIST: list[Game] = list(set(map(lambda x: x[0], GAME_MODES.values())))

MATCHES_STATS: MatchesStats = {
    C.MATCHES: 0,
    C.FULLMATCHES: 0,
    C.PLAYED: 0,
}


def player_init(data: dict) -> Player:
    time_now = datetime.datetime.now(datetime.UTC).isoformat().replace('+00:00', 'Z')
    log: GameStatusLog = {
        C.UNO: data.get(C.UNO) or '',
        C.GAME_MODE: C.MW_MP,
        'records': 0,
        C.SOURCE: player_init.__name__,
        C.TIME: time_now,
    }
    games: GamesStatus = {
        game_mode: {
            C.STATUS: 0,
            C.MATCHES: {
                C.STATS: MATCHES_STATS.copy(),
                C.LOGS: [
                    log if game_mode == C.ALL else (log | {C.GAME_MODE: game_mode})
                ],
            },
            C.STATS: {
                C.LOGS: [
                    log if game_mode == C.ALL else (log | {C.GAME_MODE: game_mode})
                ],
            },
        }
        for game_mode in GAME_MODE_LIST
    }
    player: Player = {
        C.UNO: '',
        C.USERNAME: [],
        C.CLANTAG: [],
        C.GAMES: games,
        C.ID: -1,
        C.ACTI: None,
        C.BATTLE: None,
        C.GROUP: None,
        C.TIME: time_now,
        C.GAMES_STATS: {},
        C.CHART: None,
        C.MOST_PLAY_WITH: None,
        C.LOADOUT: None,
        C.DATA: {},
    }

    player |= data

    return player
