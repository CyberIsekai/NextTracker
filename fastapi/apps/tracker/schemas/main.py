import datetime
from typing import Literal, Annotated
from dataclasses import dataclass

from pydantic import BaseModel, field_validator
from fastapi import HTTPException, Query, status

from core.config import settings

from apps.base.schemas.main import C

TrackerStatus = Literal['active', 'inactive', 'break']
PlayerStatus = Literal[0, 1, 2, 3]

PlayerColumnType = Literal['basic, raw', 'all', 'games_stats', 'games']

GameOnly = Literal['mw', 'cw', 'vg']
ModeOnly = Literal['mp', 'wz']
GameModeMw = Literal['mw_mp', 'mw_wz']
GameModeOnly = GameModeMw | Literal['cw_mp', 'vg_mp']

Game = GameOnly | Literal['all']
Mode = ModeOnly | Literal['all']
GameMode = Literal['all'] | GameModeOnly

TaskStatus = Literal['started', 'added', 'already running', 'in queues']

MatchColumn = Literal[
    'timePlayed',
    'kills',
    'deaths',
    'kdRatio',
    'headshots',
    'damageDone',
    'longestStreak',
    'assists',
    'score',
    'scorePerMinute',
]

GameBasicColumn = Literal['result', 'duration'] | MatchColumn

LabelType = Literal[
    'map',
    'mode',
    'games_stats',
    'weapons',
    'attachments',
    'perks',
    'killstreaks',
    'tactical',
    'lethal',
]
YearWzTable = Literal['2020', '2021', '2022', '2023']
Year = Literal['2019', '2020', '2021', '2022', '2023']
MatchesSourceMatches = Literal['matches']
MatchesSourceFullmatches = Literal['all', 'basic', 'main']
MatchesSource = MatchesSourceMatches | MatchesSourceFullmatches

PlatformOnly = Literal['uno', 'acti', 'battle']
Platform = PlatformOnly | Literal['search', 'tracker_search']
DataTypeOnly = Literal['matches', 'matches_history', 'stats']
DataType = DataTypeOnly | Literal['fullmatches', 'search', 'fullmatches_pars']
TargetType = Literal['player', 'group']

GameDataSlugs = tuple[str, GameMode, DataType, PlatformOnly, int]
RouterOrder = (
    GameBasicColumn
    | Literal[
        'id',
        'time',
        '-id',
        '-time',
        '-duration',
        '-timePlayed',
        '-kills',
        '-deaths',
        '-kdRatio',
        '-damageDone',
        '-headshots',
        '-longestStreak',
        '-assists',
        '-scorePerMinute',
        '-score',
    ]
)
ResetType = Literal[
    'players',
    'users',
    'loadout',
    'chart',
    'matches_stats',
    'task_queues',
    'base_stats',
    'tracker_stats',
    'clear_players_match_doubles',
    'auto_update',
    'store_data',
    'update_players',
    'status',
    'matches',
    'monitor',
    'reboot',
    'shutdown',
]


@dataclass
class MatchResultMp:
    '''Store multiplayer match result'''

    DRAW = 0
    WIN = 1
    LOSS = 2


@dataclass
class SGame:
    '''Store game statuses'''

    NOT_ENABLED = 0
    ENABLED = 1
    DISABLED = 2


@dataclass
class SPlayerParsed:
    '''Store game statuses'''

    NONE = 0
    MATCHES = 1
    FULLMATCHES = 2
    ALL_AND_DISABLED = 3


@dataclass
class SC:
    '''Global store game columns for tracker'''

    new_columns = set()
    PLATFORMS: tuple[PlatformOnly] = PlatformOnly.__args__
    META = (
        C.DURATION,
        C.MATCHID,
        C.MAP,
        C.MODE,
        C.RESULT,
        'team1Score',
        'team2Score',
        'playerCount',
        'teamCount',
        'weaponStats',
    )
    ROUND = (
        'kdRatio',
        'wlRatio',
        'scorePerGame',
        'scorePerMinute',
        'ekiadRatio',
        'averageSpeedDuringMatch',
        'percentTimeMoving',
    )
    PLAYER = (
        C.UNO,
        C.USERNAME,
        C.CLANTAG,
        C.TEAM,
        C.LOADOUT,
        'operator',
        'operatorSkinId',
        'operatorExecution',
    )
    MATCH_STATS: tuple[MatchColumn] = MatchColumn.__args__
    GAME_BASIC_COLUMNS: tuple[GameBasicColumn] = (C.DURATION, C.RESULT) + MATCH_STATS
    BASIC = GAME_BASIC_COLUMNS + (C.ID, C.UNO, C.USERNAME, C.TEAM)
    BASIC_FIELDS = GAME_BASIC_COLUMNS + (
        C.ID,
        C.UNO,
        C.MATCHID,
        C.TIME,
        C.MAP,
        C.MODE,
    )
    BASIC_STATS = BASIC_FIELDS + (C.DURATION,)
    ALL_STATS = BASIC_FIELDS + (
        C.USERNAME,
        C.CLANTAG,
        C.TEAM,
        'team1Score',
        'team2Score',
        C.LOADOUT,
        'weaponStats',
    )
    MATCH_META = (C.TIME, C.MODE, C.MAP, C.DURATION)
    MATCH = {
        C.ALL: {C.BASIC: BASIC},
        C.MW_MP: {
            C.BASIC: BASIC + (C.CLANTAG,),
            'meta': MATCH_META + ('team1Score', 'team2Score'),
        },
        C.MW_WZ: {
            C.BASIC: BASIC + (C.CLANTAG,),
            'meta': MATCH_META,
        },
        C.CW_MP: {
            C.BASIC: BASIC,
        },
        C.VG_MP: {
            C.BASIC: BASIC,
        },
    }
    RENAME_TO_BASIC = {
        'xpAtEnd': 'totalXp',
        'damageDealt': 'damageDone',
        'highestStreak': 'longestStreak',
        'teamPlacement': C.RESULT,
    }


class Error(BaseModel):
    detail: str


RouterTarget = Annotated[str, Query(max_length=settings.LOGIN_LENGTH_LIMIT)]
RouterDataType = Literal['uno', 'username', 'clantag']


class Router(BaseModel):
    data_type: RouterDataType
    target: RouterTarget
    game: Game
    mode: Mode
    game_mode: GameMode
    order: RouterOrder
    page: int
    date: str

    @field_validator(C.DATE)
    def validate_date(cls, value: str):
        if value == '':
            return value

        exception = HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f'{C.DATE} {C.NOT_VALID}'
        )
        splitted = value.split('-')
        if len(splitted) not in (1, 2, 3):
            raise exception

        year = splitted.pop(0)
        month = splitted.pop(0) if splitted else None
        day = splitted.pop(0) if splitted else None

        if year not in Year.__args__:
            raise exception
        if month and month.isdigit() is False:
            raise exception
        if day and day.isdigit() is False:
            raise exception

        return value


class StatsRouter(BaseModel):
    uno: RouterTarget
    game: Game


UpdateRouterDataType = Literal[
    'matches', 'matches_history', 'fullmatches_pars', 'stats', 'all'
]


class UpdateRouter(BaseModel):
    data_type: UpdateRouterDataType
    uno: RouterTarget
    game_mode: GameMode


class SocketBody(BaseModel):
    name: Literal['player_game_mode_access']
    value: dict


class LabelData(BaseModel):
    name: str
    label: str | None = None


class MatchLoadoutDataWeaponStats(BaseModel):
    # don't change order of the columns, used for encoding weaponStats
    kills: int
    deaths: int
    hits: int
    shots: int
    headshots: int
    xpEarned: int
    startingWeaponXp: int


class MatchLoadoutDataStats(LabelData):
    stats: MatchLoadoutDataWeaponStats


class MatchLoadoutWeapon(LabelData):
    attachments: list[LabelData]


class MatchLoadout(BaseModel):
    # don't change order of the columns, used for encoding loadout
    primaryWeapon: MatchLoadoutWeapon
    secondaryWeapon: MatchLoadoutWeapon
    perks: list[LabelData]
    killstreaks: list[LabelData]
    tactical: LabelData | None = None
    lethal: LabelData | None = None


class MatchesData(BaseModel):
    id: int
    game_mode: GameModeOnly
    matchID: str
    map: LabelData
    mode: LabelData
    result: int
    time: datetime.datetime
    player: str
    loadout: dict[str, int]
    weaponStats: list[MatchLoadoutDataStats] | None = None
    source: MatchesSource

    duration: int
    timePlayed: int
    kills: int
    deaths: int
    kdRatio: float
    damageDone: int
    headshots: int
    longestStreak: int
    assists: int
    scorePerMinute: float
    score: int


class MatchesResponse(BaseModel):
    matches: list[MatchesData]
    found: int


class UpdateResponse(BaseModel):
    message: str
    time: str | None = None
    seconds_wait: int = 0


class EditPlayerResponse(BaseModel):
    message: str
    result: int | str | dict | None = None


class ChartData(BaseModel):
    years: dict
    summ: int


class Chart(BaseModel):
    all: ChartData
    mw_mp: ChartData
    mw_wz: ChartData
    cw_mp: ChartData
    vg_mp: ChartData
    time: str


class MostPlayWithData(BaseModel):
    uno: str
    count: int
    username: str
    clantag: str


class MostPlayWith(BaseModel):
    all: list[MostPlayWithData]
    mw_mp: list[MostPlayWithData]
    mw_wz: list[MostPlayWithData]
    time: str


class MostCommonUnoData(BaseModel):
    uno: str
    count: int
    username: list[str]
    clantag: list[str]
    group: str | None


class LoadoutStatsData(BaseModel):
    count: int
    name: str


class Loadout(BaseModel):
    all: list[LoadoutStatsData]
    mw_mp: list[LoadoutStatsData]
    mw_wz: list[LoadoutStatsData]
    time: str


class MatchesStats(BaseModel):
    matches: int
    fullmatches: int
    played: int


class GameStatusLog(BaseModel):
    uno: str
    game_mode: GameModeOnly
    source: str
    records: int
    time: str


GameStatsAllBasicKeys = Literal[
    'kills',
    'deaths',
    'kdRatio',
    'headshots',
    'longestStreak',
    'assists',
    'score',
    'scorePerMinute',
    'wins',
    'losses',
    'wlRatio',
    'totalShots',
    'hits',
    'misses',
    'accuracy',
    'scorePerGame',
    'suicides',
    'currentWinStreak',
    'totalGamesPlayed',
    'timePlayedTotal',
]

GameStatsDataWeaponKeys = Literal[
    'weapon_assault_rifle',
    'weapon_smg',
    'weapon_shotgun',
    'weapon_sniper',
    'weapon_lmg',
    'weapon_pistol',
    'weapon_marksman',
    'weapon_melee',
    'weapon_launcher',
    'weapon_other',
]

StatNameBasic = Literal[
    'kills',
    'deaths',
    'kdRatio',
    'score',
    'scorePerMinute',
]
StatNameMap = Literal[
    'timePlayed',
    'win',
    'loss',
    'draw',
    'wlRatio',
    'stat1',
    'stat2',
    'stat1Stat2Ratio',
    'avgStat1',
    'avgStat2',
]
StatNameScorestreakCW = Literal[
    'kills',
    'deaths',
    'uses',
    'assists',
    'destructions',
    'enemyCarePackageCaptures',
    'multikillForMedalSpotlight',
    'armoredKills',
    'bestAssists',
    'bestKillsPerGame',
    'bestKills',
    'bestDestructions',
    'bestEnemyCarePackageCaptures',
    'bestKillsPerUse',
]
StatNameMP = (
    StatNameBasic
    | Literal[
        'time',
        'timePlayed',
        'setBacks',
        'stabs',
        'captures',
        'defends',
        'denies',
        'confirms',
        'plants',
        'defuses',
    ]
)
StatNameWZ = Literal[
    'timePlayed',
    'wins',
    'downs',
    'topTwentyFive',
    'objTime',
    'topTen',
    'contracts',
    'revives',
    'topFive',
    'gamesPlayed',
    'tokens',
    'cash',
]
StatNameWeaponBasic = Literal[
    'kills',
    'deaths',
    'kdRatio',
    'accuracy',
    'headshots',
    'hits',
    'shots',
]
StatNameWeapon = (
    StatNameWeaponBasic
    | Literal[
        'uses',
        'extraStat1',
        'awardedCount',
        'misc1',
        'misc2',
    ]
)
StatNameAttachment = Literal[
    'kills',
    'deaths',
    'headshots',
    'hits',
    'shots',
]
StatNameCWMP = (
    StatNameMP
    | Literal[
        'timePlayedTotal',
        'wins',
        'objectiveScore',
        'killStreak',
        'ekiadRatio',
        'damagePerGame',
        'winStreak',
        'offends',
        'curWinStreak',
        'losses',
        'ekia',
        'totalDamage',
        'crush',
        'wlRatio',
        'ties',
        'assists',
    ]
)
StatNameCW = Literal[
    'used',
    'assists',
    'damageDone',
    'timeUsed',
    'ekia',
    'deathsDuringUse',
    'gamesUsed',
    'destroyed',
    'masterCraftCamoProgression',
    'killstreak30',
    'combatRecordStat',
    'backstabberKill',
    'challenges',
    'challenge1',
    'challenge2',
    'challenge3',
    'challenge4',
    'challenge5',
    'challenge6',
    'challenge7',
]
StatNameScorestreakCW = Literal[
    'kills',
    'deaths',
    'uses',
    'assists',
    'destructions',
    'enemyCarePackageCaptures',
    'multikillForMedalSpotlight',
    'armoredKills',
    'bestAssists',
    'bestKillsPerGame',
    'bestKills',
    'bestDestructions',
    'bestEnemyCarePackageCaptures',
    'bestKillsPerUse',
]

StatNameAll = dict[
    StatNameMP
    | StatNameWZ
    | StatNameWeapon
    | StatNameCW
    | StatNameCWMP
    | StatNameScorestreakCW,
    int | float | None,
]


class GameStatsDataLifetimeBasic(BaseModel):
    all: dict[
        Literal['properties'], dict[GameStatsAllBasicKeys, int] | dict[str, int | None]
    ]
    mode: dict[
        str,
        dict[
            Literal['properties'],
            dict[StatNameBasic, int] | dict[StatNameMP | StatNameWZ, int | None],
        ],
    ]
    map: dict[str, dict[str, dict[Literal['properties'], dict[StatNameMap, int]]]]


GameStatsDataWeaponValue = dict[
    GameStatsDataWeaponKeys,
    dict[str, dict[Literal['properties'], dict[StatNameWeapon, int]]],
]


class GameStatsDataLifetime(GameStatsDataLifetimeBasic):
    accoladeData: dict[
        Literal['properties'],
        dict[str, int] | dict[str, int | None],
    ]
    attachmentData: (
        dict[str, dict[Literal['properties'], dict[StatNameAttachment, int]]] | None
    )
    scorestreakData: dict[
        Literal['lethalScorestreakData', 'supportScorestreakData'],
        dict[
            str,
            dict[
                Literal['properties'],
                dict[Literal['uses', 'extraStat1', 'awardedCount'], int],
            ],
        ],
    ]
    itemData: (
        dict[
            Literal['lethals'],
            dict[Literal['properties'], dict[Literal['uses', 'kills'], int]],
        ]
        | dict[
            Literal['tacticals'],
            dict[Literal['properties'], dict[Literal['uses', 'extraStat1'], int]],
        ]
        | dict[
            Literal['supers'],
            dict[
                Literal['properties'],
                dict[Literal['uses', 'kills', 'misc1', 'misc2'], int],
            ],
        ]
        | GameStatsDataWeaponValue
    )


GameStatsDataLifetimeCWScorestreakData = dict[
    Literal['scorestreakData'],
    dict[str, dict[Literal['properties'], dict[StatNameScorestreakCW, int]]],
]


class GameStatsDataLifetimeCW(GameStatsDataLifetimeBasic):
    scorestreakData: GameStatsDataLifetimeCWScorestreakData
    itemData: (
        dict[Literal['scorestreak'], GameStatsDataLifetimeCWScorestreakData]
        | dict[
            GameStatsDataWeaponKeys,
            dict[
                str,
                dict[
                    Literal['properties'], dict[StatNameWeaponBasic | StatNameCW, int]
                ],
            ],
        ]
    )
    attachmentData: dict[
        str,
        dict[
            Literal['properties'],
            dict[StatNameAttachment | StatNameCW, int],
        ],
    ]


GameStatsDataKeys = (
    GameStatsDataWeaponKeys
    | Literal[
        'scorestreak',
        'attachment',
        'lethals',
        'tacticals',
        'supers',
    ]
)
GameStatsData = dict[Literal['all'] | str, StatNameAll]
GameStats1 = (
    dict[GameStatsDataKeys, StatNameAll]
    | dict[Literal['all'], dict[GameStatsAllBasicKeys | str, int | float]]
)


class GameStats(BaseModel):
    all: dict[GameStatsAllBasicKeys | str, int | float]
    all_additional: dict[str, int | float] | None = None
    scorestreak: GameStatsData | None = None
    weapon_assault_rifle: GameStatsData | None = None
    weapon_smg: GameStatsData | None = None
    weapon_shotgun: GameStatsData | None = None
    weapon_sniper: GameStatsData | None = None
    weapon_lmg: GameStatsData | None = None
    weapon_pistol: GameStatsData | None = None
    weapon_marksman: GameStatsData | None = None
    weapon_melee: GameStatsData | None = None
    weapon_launcher: GameStatsData | None = None
    weapon_other: GameStatsData | None = None
    attachment: GameStatsData | None = None
    lethals: GameStatsData | None = None
    tacticals: GameStatsData | None = None
    supers: GameStatsData | None = None


class GameStatsBestPlayerRecord(BaseModel):
    uno: str
    value: int | float


GameStatsDataBest = dict[Literal['all'] | str, dict[str, GameStatsBestPlayerRecord]]


class GameStatsBest(BaseModel):
    all: dict[str, GameStatsBestPlayerRecord | None]
    all_additional: dict[str, GameStatsBestPlayerRecord | None] | None = None
    scorestreak: GameStatsDataBest | None = None
    weapon_assault_rifle: GameStatsDataBest | None = None
    weapon_smg: GameStatsDataBest | None = None
    weapon_shotgun: GameStatsDataBest | None = None
    weapon_sniper: GameStatsDataBest | None = None
    weapon_lmg: GameStatsDataBest | None = None
    weapon_pistol: GameStatsDataBest | None = None
    weapon_marksman: GameStatsDataBest | None = None
    weapon_melee: GameStatsDataBest | None = None
    weapon_launcher: GameStatsDataBest | None = None
    weapon_other: GameStatsDataBest | None = None
    attachment: GameStatsDataBest | None = None
    lethals: GameStatsDataBest | None = None
    tacticals: GameStatsDataBest | None = None
    supers: GameStatsDataBest | None = None


class GameStatusMatches(BaseModel):
    stats: MatchesStats
    logs: list[GameStatusLog]


class GameStatusStats(BaseModel):
    logs: list[GameStatusLog]


class GameStatus(BaseModel):
    status: int
    matches: GameStatusMatches
    stats: GameStatusStats


class GameStatusAll(BaseModel):
    status: PlayerStatus
    matches: GameStatusMatches
    stats: GameStatusStats


class GamesStatus(BaseModel):
    all: GameStatusAll
    mw_mp: GameStatus
    mw_wz: GameStatus
    cw_mp: GameStatus
    vg_mp: GameStatus


class PlayerMatchesHistoryPars(BaseModel):
    message: str
    statuses: list[str] | None = None


class PlayerMatchesDeleteResponse(BaseModel):
    mw_mp: int
    mw_wz: int
    cw_mp: int
    vg_mp: int


class PlayerSearch(BaseModel):
    platform: Platform
    target: str
    uno: str | None = None


class PlayerAdd(BaseModel):
    uno: str
    group: str


class TargetDataStats(BaseModel):
    chart: Chart | None = None
    most_play_with: MostPlayWith | None = None
    loadout: Loadout | None = None


class TargetDataBasic(BaseModel):
    uno: str
    username: list[str]
    clantag: list[str]
    games: GamesStatus


class PlayerData(TargetDataBasic, TargetDataStats):
    games_stats: dict[Game | None, GameStats | None]
    group: str


class GroupData(TargetDataBasic, TargetDataStats):
    games_stats: dict[Game, GameStats | None]
    games_stats_best: dict[Game, GameStatsBest | None]
    players: dict[str, TargetDataBasic]


class PlayerBasic(BaseModel):
    id: int
    uno: str
    acti: str | None = None
    battle: str | None = None
    username: list[str]
    clantag: list[str]

    group: str | None = None
    games: GamesStatus
    time: datetime.datetime


class Player(PlayerBasic, TargetDataStats):
    time: str

    games_stats: dict[Game, GameStats]
    data: dict | None = None


class AllPlayers(BaseModel):
    players: list[PlayerBasic]


class MatchPlayer(BaseModel):
    id: int
    uno: str
    username: str
    clantag: str | None = None
    result: int
    stats: dict[MatchColumn, int | float]


class MatchStatsPlayer(BaseModel):
    id: int
    uno: str
    username: str
    clantag: str | None
    result: int

    matchID: str
    map: LabelData
    mode: LabelData
    team: str
    loadout: list[MatchLoadout]
    weaponStats: list[MatchLoadoutDataStats]
    source: MatchesSource
    time: datetime.datetime
    stats: dict[GameBasicColumn | str, int | float | str]


class TeamData(BaseModel):
    name: str
    players: list[MatchPlayer]
    result: int
    stats: dict[MatchColumn, int | float]


class MatchData(BaseModel):
    map: LabelData
    mode: LabelData
    duration: str
    time: datetime.datetime
    source: MatchesSource
    stats: dict[MatchColumn, int | float]
    team: list[TeamData]


class LogsTracker(BaseModel):
    target: str
    game_mode: GameMode
    message: str
    time: str
    key: str


class ResetResponse(BaseModel):
    time_taken: str


class SearchResp(BaseModel):
    message: str
    status: Literal[0, 1, 2, 3]
    result: str | Player | list[dict] | None
    time: str


class RequestError(BaseModel):
    error: str
    trace: str


class PlayerPlatforms(BaseModel):
    uno: str
    acti: str | None = None
    battle: str | None = None


class LogsSearchData(PlayerPlatforms):
    username: list[str]


class LogsSearch(BaseModel):
    id: int
    target: str
    uno: str | None = None
    data: list[LogsSearchData]
    time: datetime.datetime


class ClearFullmatchDoublesBody(BaseModel):
    game_mode: GameMode
    matchID: str


class ClearFullmatchDoublesResult(BaseModel):
    uno: str
    username: str


class ClearFullmatchesDoublesResponse(BaseModel):
    message: str
    result: list[ClearFullmatchDoublesResult]


class TargetGameMode(BaseModel):
    target: str
    game_mode: GameMode


class MatchBody(BaseModel):
    game_mode: GameModeOnly
    match_id: int
    source: MatchesSource
    year: Year


class TableGameData(BaseModel):
    game_mode: GameModeOnly
    table: object
    name: str
    source: MatchesSource


class UpdatePlayers(BaseModel):
    uno: str
    player: str
    group: str
    mw_mp: int | Literal['pending', 'skipped', 'not found']
    mw_wz: int | Literal['pending', 'skipped', 'not found']
    cw_mp: int | Literal['pending', 'skipped', 'not found']
    vg_mp: int | Literal['pending', 'skipped', 'not found']


class StatsRow(BaseModel):
    rows: int
    last_id: int


class TrackerStatsFullmatchesType(BaseModel):
    all: StatsRow
    mw_mp: StatsRow
    mw_wz: dict[Literal['all'] | YearWzTable, StatsRow]
    cw_mp: StatsRow
    vg_mp: StatsRow


class TrackerStatsNonMatches(BaseModel):
    players: StatsRow
    cod_logs: StatsRow
    cod_logs_error: StatsRow
    cod_logs_search: StatsRow
    cod_logs_task_queues: StatsRow


class TrackerStatsValue(BaseModel):
    matches: dict[GameMode, StatsRow]
    fullmatches_main: TrackerStatsFullmatchesType
    fullmatches_basic: TrackerStatsFullmatchesType
    summary: dict[GameMode, int]
    non_matches: TrackerStatsNonMatches
    most_play_with: MostPlayWith


class TrackerStats(BaseModel):
    data: TrackerStatsValue
    time: str


class Task(BaseModel):
    id: int
    name: str
    uno: str
    game_mode: GameMode
    data_type: DataType
    status: Literal[
        'pending',
        'pause',
        'running',
        'completed',
        'error',
        'deleted',
    ]
    data: dict[str, str | int]
    time: str
    time_started: str | None
    time_end: str | None


class BaseStats(BaseModel):
    data: dict[str, StatsRow]
    time: datetime.datetime


class PanelStatuses(BaseModel):
    status: TrackerStatus
    monitor: bool
    auto_update: bool
    store_data: bool


class Panel(BaseModel):
    time: str | None
    statuses: PanelStatuses
    pages: dict[str, int | None]
    task_queues: list[Task]
    update_players: list[UpdatePlayers]
    base_stats: BaseStats
    tracker_stats: TrackerStats
    resets: list[ResetType]
    groups: list[str]


class FullmatchData(BaseModel):
    matchID: str
    year: Year


class ImageGameMap(BaseModel):
    name: str
    time: datetime.datetime


ImageGameMaps = dict[GameModeOnly, list[ImageGameMap]]


class ImageUploadFiles(BaseModel):
    name: str
    b64_thumb: str
    b64_full: str


class ImageUpload(BaseModel):
    files: list[ImageUploadFiles]
    epoch: int


class ImageUploadSubmit(BaseModel):
    images: list[str]
    epoch: int
    game_mode: GameMode


class ImageData(BaseModel):
    name: str
    new_name: str
    game_mode: GameMode


class LabelsItem(BaseModel):
    id: int
    name: str
    label: str | None
    game_mode: GameMode
    time: datetime.datetime

    @field_validator(C.NAME)
    def validate_name(cls, value: str):
        if not value.strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f'{C.NAME} required'
            )
        if len(value) >= settings.NAME_LIMIT_2:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f'{C.NAME} length limit {settings.NAME_LIMIT_2}',
            )

        return value

    @field_validator(C.LABEL)
    def validate_label(cls, value: str | None):
        if not value or not value.strip():
            value = None
        elif len(value) >= settings.NAME_LIMIT_2:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f'{C.LABEL} length limit {settings.NAME_LIMIT_2}',
            )

        return value


class Labels(BaseModel):
    labels: list[LabelsItem]


class FixturePlayers(BaseModel):
    player: PlayerData
    group: GroupData
    search_bodys: list[PlayerSearch]


class FixtureMatches(BaseModel):
    match: dict[GameMode, list[FullmatchData]]
    match_stats: list[MatchBody]
    targets: dict[GameMode, dict[str, set]]


class PlayersSearch(BaseModel):
    players: dict[str, Player]
    checked: int
