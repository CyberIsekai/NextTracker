import datetime
from typing import Annotated, Any, Literal
from dataclasses import dataclass

from fastapi import HTTPException, Query, status
from pydantic import BaseModel, EmailStr, field_validator

from core.config import settings

from apps.base.schemas.basic import Language


@dataclass
class M:
    '''Store Methods'''

    GET = 'GET'
    POST = 'POST'
    PUT = 'PUT'
    DELETE = 'DELETE'


@dataclass
class C:
    '''Store Const'''

    LOADING = 'loading'
    REFRESH = 'refresh'

    # base
    ID = 'id'
    TARGET = 'target'
    ADMIN = 'admin'
    USER = 'user'
    GUEST = 'guest'
    USERS = 'users'
    LOGIN = 'login'
    PASSWORD = 'password'
    USERNAME = 'username'
    EMAIL = 'email'
    ALL = 'all'
    DATA = 'data'
    STATUS = 'status'
    MONITOR = 'monitor'
    ERROR = 'error'
    MESSAGE = 'message'
    DETAIL = 'detail'
    RESULT = 'result'
    PLACE = 'place'
    NAME = 'name'
    VALUE = 'value'
    SOURCE = 'source'
    DELETE = 'delete'
    DELETED = 'deleted'
    TIME = 'time'
    TIME_TAKEN = 'time_taken'
    DURATION = 'duration'
    TIME_PLAYED = 'timePlayed'
    DATETIME = 'datetime'
    ORDER = 'order'
    DATE = 'date'
    PAGE = 'page'
    PAGES = 'pages'
    EPOCH = 'epoch'
    ISO = 'iso'
    LOGS = 'logs'
    NOT_VALID = 'not valid'
    NOT_FOUND = 'not found'
    ALREADY_EXIST = 'already exist'
    YEAR = 'year'
    LANGUAGE = 'language'
    ROLE = 'role'
    ROLES = 'roles'
    LEVEL = 'level'
    STATS = 'stats'
    BASE = 'base'
    AUTO_UPDATE = 'auto_update'
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    TOKEN = 'token'
    CONFIG = 'config'
    CONFIGS = 'configs'

    # languages
    EN = 'en-US'
    RU = 'ru-RU'

    # notes
    NOTE = 'note'
    NOTES = 'notes'
    UNCOMPLETED = 'uncompleted'

    # tracker
    MW = 'mw'
    CW = 'cw'
    VG = 'vg'
    MP = 'mp'
    WZ = 'wz'
    MW_MP = 'mw_mp'
    MW_WZ = 'mw_wz'
    CW_MP = 'cw_mp'
    VG_MP = 'vg_mp'
    UNO = 'uno'
    ACTI = 'acti'
    BATTLE = 'battle'
    UNOS = 'unos'
    CLANTAG = 'clantag'
    GAMES = 'games'
    GAME = 'game'
    MAP = 'map'
    MODE = 'mode'
    GAME_MODE = 'game_mode'
    DATA_TYPE = 'data_type'
    PLAYER_TAG = 'player_tag'
    TARGET_TYPE = 'target_type'
    PLATFORM = 'platform'
    PLAYER = 'player'
    PLAYERS = 'players'
    GROUP = 'group'
    GROUPS = 'groups'
    UPDATE_PLAYERS = 'update_players'
    BASIC = 'basic'
    MAIN = 'main'
    MATCHID = 'matchID'
    MATCH = 'match'
    MATCHES = 'matches'
    MATCHES_HISTORY = 'matches_history'
    FULLMATCHES = 'fullmatches'
    FULLMATCHES_PARS = 'fullmatches_pars'
    KILLS = 'kills'
    DEATHS = 'deaths'
    KDRATIO = 'kdRatio'
    ACCURACY = 'accuracy'
    HEADSHOTS = 'headshots'
    SEARCH = 'search'
    SUMMARY = 'summary'
    TRACKER = 'tracker'
    LABEL = 'label'
    CHART = 'chart'
    MOST_PLAY_WITH = 'most_play_with'
    LOADOUT = 'loadout'
    GAMES_STATS = 'games_stats'
    TASK_QUEUES = 'task_queues'
    RAW = 'raw'
    PLAYED = 'played'
    COMPLETED = 'completed'
    TRANSLATE = 'translate'
    ENABLED = 'enabled'
    DISABLED = 'disabled'
    ROWS = 'rows'
    TEAM = 'team'
    STATIC = 'static'
    FILES = 'files'
    COUNT = 'count'


@dataclass
class SUser:
    '''User statuses'''

    NOT_ENABLED = 0
    ENABLED = 1


@dataclass
class STask:
    PENDING = 'pending'
    PAUSE = 'pause'
    RUNNING = 'running'
    COMPLETED = C.COMPLETED
    ERROR = C.ERROR
    DELETED = C.DELETED


@dataclass
class STaskStatus:
    STARTED = 'started'
    ADDED = 'added'
    ALREADY_RUNNING = 'already running'
    IN_QUEUES = 'in queues'


@dataclass
class SMessage:
    '''Store statuses'''

    ERROR = 0
    SUCCESS = 1
    MESSAGE = 2
    ALERT = 3


FormatDate = Literal['iso', 'epoch', 'time', 'date', 'datetime'] | None

LogsBasic = Literal[
    'logs',
    'logs_user',
    'logs_error',
    'cod_logs',
    'cod_logs_player',
    'cod_logs_error',
    'logs_url',
    'logs_ip',
]
LogsRequests = Literal[
    'logs_request',
    'logs_request_error',
    'logs_request_auth',
]
LogsSourceCache = Literal['cod_logs_cache']
LogsSourceOnly = (
    LogsBasic
    | LogsRequests
    | LogsSourceCache
    | Literal[
        'cod_logs_search',
        'cod_logs_task_queues',
    ]
)
LogsSource = LogsSourceOnly | Literal['all']
RedisAction = Literal[
    'get',
    'set',
    'rpush',
    'lpush',
    'lrange',
    'lindex',
    'lpop',
    'llen',
    'lset',
    'ltrim',
    'lrem',
    'hset',
    'hget',
    'hdel',
    'hmget',
    'hkeys',
    'hgetall',
    'delete',
    'keys',
    'flushall',
]
RedisValue = str | int | dict
RedisTargetStatus = Literal['auto_update', 'store_data']
RedisTargetGet = RedisTargetStatus | Literal['status', 'translate']
RedisTargetList = (
    LogsSourceCache
    | Literal[
        'task_queues',
        'update_players',
        'change_logs',
    ]
)
RedisTargetHash = Literal[
    'player',
    'group',
    'user',
    # f'matches:{str}',
]
RedisTarget = RedisTargetGet | RedisTargetList | RedisTargetHash

ConfigName = Literal['stats']
ConfigSource = Literal['base', 'tracker']
Translate = Literal['translate', 'translate_stats']
Password = Annotated[
    str,
    Query(
        min_length=settings.PASSWORD_LENGTH_REQUIRED,
        max_length=settings.PASSWORD_LENGTH_LIMIT,
    ),
]
Login = Annotated[
    str,
    Query(
        min_length=settings.LOGIN_LENGTH_REQUIRED,
        max_length=settings.LOGIN_LENGTH_LIMIT,
    ),
]


class Error(BaseModel):
    detail: str


class Message(BaseModel):
    message: str


class Status(BaseModel):
    status: bool


class UsersPage(BaseModel):
    name: str
    path: str
    sub_pages: list[str]


class RequestData(BaseModel):
    path: str | None = None
    client: str
    login: str | None = None
    user_agent: str


class UserProfile(BaseModel):
    login: Login
    email: EmailStr | None = None
    username: str | None = None
    language: Language
    token: str
    pages: list[UsersPage]
    roles: list[str]
    time: str


class User(UserProfile):
    id: int
    status: int
    password: Password
    data: dict


class UserRegister(BaseModel):
    login: Login
    email: EmailStr | None = None
    username: str | None = None
    language: Language
    password: Password
    data: dict[str, str]


class UserAuthorize(BaseModel):
    login: Login
    password: Password

    @field_validator(C.LOGIN)
    def validate_login(cls, value: str):
        if not value or not value.strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f'{C.LOGIN} {C.NOT_VALID}'
            )

        return value.lower()


class UsersResponse(BaseModel):
    users: list[UserProfile]
    roles: list[str]


class StatsRow(BaseModel):
    rows: int
    last_id: int


class BaseStats(BaseModel):
    value: dict[str, StatsRow]
    time: datetime.datetime


class EditTarget(BaseModel):
    target: str
    name: str
    value: Any


class EditTargetResponse(BaseModel):
    message: str
    result: Any


class IpData(BaseModel):
    status: str
    message: str | None = None
    country: str | None = None
    regionName: str | None = None


class LogsResponse(BaseModel):
    logs: list[dict]


class LogsRequestData(BaseModel):
    ip: IpData | None = None
    login: str
    detail: str | None = None
    trace: str | None = None
    body: dict[str, str | int] | None


class LogsRequest(BaseModel):
    id: int
    client: str
    path: str
    user_agent: str
    data: LogsRequestData
    time: datetime.datetime


class LogsUniversal(BaseModel):
    id: int
    target: str
    message: str
    data: dict | None = None
    time: datetime.datetime


class Config(BaseModel):
    id: int
    name: str
    source: str
    data: dict
    time: str | datetime.datetime

    @field_validator(C.NAME)
    def validate_name(cls, value: str):
        if not value.strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f'{C.CONFIG} {C.NAME} required'
            )
        if len(value) > settings.NAME_LIMIT:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f'{C.CONFIG} {C.NAME} length limit {settings.NAME_LIMIT}',
            )

        return value

    @field_validator(C.SOURCE)
    def validate_source(cls, value: str):
        if not value.strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f'{C.CONFIG} {C.SOURCE} required'
            )

        return value


class ConfigResponse(BaseModel):
    configs: list[Config]


class UsersRole(BaseModel):
    id: int
    name: str
    level: int
    access: list[str]
    pages: list[UsersPage]

    @field_validator(C.NAME)
    def validate_name(cls, value: str):
        name = value.strip().lower()
        if not name:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f'[{value}] {C.NOT_VALID}'
            )

        return name


class UsersRoleResponse(BaseModel):
    roles: list[UsersRole]


class TranslatesWord(BaseModel):
    id: int
    name: str
    en: str | None
    ru: str | None

    @field_validator(C.NAME)
    def validate_name(cls, value: str):
        name = value.strip().lower()
        if not name:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f'[{value}] {C.NOT_VALID}'
            )

        return name

    @field_validator('en')
    def validate_en(cls, value: str | None):
        if isinstance(value, str) and not value.strip():
            value = None

        return value

    @field_validator('ru')
    def validate_ru(cls, value: str | None):
        if isinstance(value, str) and not value.strip():
            value = None
        return value


class TranslatesResponse(BaseModel):
    translate: list[TranslatesWord]


class TranslatesStore(BaseModel):
    translate: dict[str, dict[Language, str | None]]
    translate_stats: dict[str, dict[Language, str | None]]
    version: str
