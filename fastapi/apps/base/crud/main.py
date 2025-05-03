from fastapi import status
from sqlalchemy.orm import Session
from sqlalchemy.sql import literal_column
from sqlalchemy.sql.expression import union
from starlette.requests import Request

from core.config import settings

from apps.base.crud.store_tables import SBT
from apps.base.crud.utils_data_init import LOGS_TABLES
from apps.base.schemas.main import (
    C,
    Config,
    ConfigResponse,
    Error,
    Message,
    Status,
    TranslatesResponse,
    TranslatesWord,
    UsersResponse,
    LogsResponse,
    User,
    UserRegister,
    UserProfile,
    UserAuthorize,
    EditTarget,
    EditTargetResponse,
    UsersRole,
    UsersRoleResponse,
    TranslatesStore,
    Translate,
    LogsSource,
    LogsSourceOnly,
    LogsSourceCache,
)
from apps.base.crud.utils import (
    token_decode,
    config_get,
    get_last_id,
    in_logs_request,
    is_number,
    is_valid_password,
    now,
    redis_manage,
    set_table_sequence,
    date_format,
    format_request,
    to_dict,
    hash_password,
    in_logs,
    json_error,
    manage_monitor,
    user_cache_set,
    users_cache_set,
    token_encode,
    is_email,
    validate_login,
    translate_version_update,
)


def test(db: Session, target: str, request: Request):  # pylint: disable=unused-argument
    return


def users_get(db: Session) -> UsersResponse:
    all_users = db.query(SBT.users).order_by(SBT.users.id).all()
    users: list[UserProfile] = []
    for user in all_users:
        user.token = ''
        user.pages = []
        user.time = date_format(user.time, C.ISO)
        users.append(to_dict(user))

    roles = db.query(SBT.users_role.name).all()
    roles: list[str] = [role.name for role in roles]

    return {C.USERS: users, C.ROLES: roles}


def user_register(
    db: Session, user: UserRegister, request: Request
) -> UserProfile | Error:
    user.data.update(format_request(request))

    if error := validate_login(user.login):
        return json_error(status.HTTP_422_UNPROCESSABLE_ENTITY, error)

    if db.query(SBT.users.login).filter(SBT.users.login.ilike(user.login)).count():
        return json_error(
            status.HTTP_302_FOUND, f'{C.USER} [{user.login}] {C.ALREADY_EXIST}'
        )

    new_user = SBT.users(
        id=get_last_id(db, SBT.users) + 1,
        login=user.login,
        email=user.email,
        password=hash_password(user.password),
        username=user.username,
        data=user.data,
        language=user.language,
        roles=[C.USER],
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user_cache = user_cache_set(db, new_user)
    user_profile = UserProfile.model_validate(user_cache)
    user_profile.token = token_encode(user_profile.login)

    return user_profile


def user_login(auth: UserAuthorize, request: Request) -> UserProfile | Error:
    user: User | None = redis_manage(f'{C.USER}:{auth.login}', 'hgetall')
    error = ''

    if user is None:
        error = f'{C.USER} [{auth.login}] {C.NOT_FOUND}'
    elif is_valid_password(auth.password, user[C.PASSWORD]) is False:
        error = f'{C.PASSWORD} {C.NOT_VALID}'

    in_logs_request(request, 'logs_request_auth', {C.ERROR: error} if error else {})

    if error:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED, f'{C.LOGIN} or {C.PASSWORD} incorrect'
        )

    user_profile = UserProfile.model_validate(user)
    user_profile.token = token_encode(user_profile.login)

    return user_profile


def user_settings(
    db: Session, body: EditTarget, request: Request
) -> EditTargetResponse | Error:
    login = token_decode(request.headers.get(C.TOKEN))

    if login in (C.GUEST, 'expired', 'invalid'):
        return json_error(status.HTTP_401_UNAUTHORIZED, f'{login} {C.TOKEN}')

    if body.name not in (C.USERNAME, C.LANGUAGE, C.EMAIL):
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED, f'{body.name} not allowed'
        )

    body.target = login

    return user_put(db, body)


def user_delete(db: Session, body: EditTarget) -> EditTargetResponse | Error:
    platform = body.name or C.LOGIN
    user = (
        db.query(SBT.users).filter(SBT.users.__dict__[platform] == body.target).first()
    )

    if user is None:
        return json_error(
            status.HTTP_404_NOT_FOUND,
            f'{C.USER} {platform} [{body.target}] {C.NOT_FOUND}',
        )

    user_dict = to_dict(user)
    user_dict[C.TIME] = date_format(user_dict[C.TIME], C.ISO)

    db.delete(user)
    db.commit()
    set_table_sequence(db, SBT.users.__tablename__)

    redis_manage(f'{C.USER}:{body.target}', C.DELETE)
    in_logs(body.target, C.DELETED, 'logs_user', user_dict)

    return {C.MESSAGE: C.DELETED, C.RESULT: C.DELETED}


def user_put(db: Session, body: EditTarget) -> EditTargetResponse | Error:
    login, name, value = body.target, body.name, body.value
    user_id, user_value = redis_manage(f'{C.USER}:{login}', 'hmget', (C.ID, name))

    if user_id is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'{C.USER} [{login}] {C.NOT_FOUND}'
        )

    if value == user_value:
        return json_error(
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'{name} {value} same {C.VALUE} not changed',
        )

    not_valid = json_error(
        status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} {value} {C.NOT_VALID}'
    )

    if name == C.USERNAME:
        if value is None:
            pass
        elif isinstance(value, str) is False:
            return not_valid
        elif len(value) < settings.LOGIN_LENGTH_REQUIRED:
            return json_error(
                status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} {value} too short'
            )
        elif len(value) > settings.LOGIN_LENGTH_LIMIT:
            return json_error(
                status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} {value} too long'
            )
    elif name == C.EMAIL:
        if is_email(value) is False:
            return not_valid
    elif name == C.LANGUAGE:
        if value not in settings.LANGUAGES:
            return not_valid
    elif name == C.ID:
        if isUsed := db.query(SBT.users.login).filter(SBT.users.id == value).first():
            return json_error(status.HTTP_302_FOUND, f'used by {isUsed.login}')
    elif name == C.STATUS:
        if is_number(value) is False:
            return not_valid
    elif name == C.ROLES:
        roles = db.query(SBT.users_role.name).all()
        roles: list[str] = [role.name for role in roles]
        if all(role in roles for role in value) is False:
            return not_valid
    elif name == C.TIME:
        if isinstance(value, int) is False:
            return not_valid
        value = date_format(value)
    elif name == C.DATA:
        if isinstance(value, dict) is False:
            return not_valid
    else:
        return json_error(status.HTTP_405_METHOD_NOT_ALLOWED, f'{name} not allowed')

    query = db.query(SBT.users).filter(SBT.users.login == login)
    query.update({SBT.users.__dict__[name]: value})
    db.commit()
    user = query.first()
    user_cache_set(db, user)

    if name == C.TIME:
        return {
            C.MESSAGE: f'{name} changed to {date_format(value, C.DATETIME)}',
            C.RESULT: date_format(value, C.ISO),
        }

    return {C.MESSAGE: f'{name} changed to {value}', C.RESULT: value}


def logs_tabs_get(db: Session):
    res: dict[LogsSource, int] = {C.ALL: 0}
    for logs_source_type in LogsSourceOnly.__args__:
        for logs_source in logs_source_type.__args__:
            if logs_source == 'cod_logs_cache':
                res[logs_source] = redis_manage(logs_source, 'llen')
                continue

            table = LOGS_TABLES[logs_source]
            logs_count = db.query(table).count()
            res[logs_source] = logs_count
            res[C.ALL] += logs_count

    return res


def logs_get(db: Session, source: LogsSource, page: int) -> LogsResponse:
    if source == C.ALL:
        logs_basic = tuple(
            db.query(LOGS_TABLES[source]).with_entities(
                LOGS_TABLES[source].id.label(C.ID),
                LOGS_TABLES[source].target.label(C.TARGET),
                LOGS_TABLES[source].message.label(C.MESSAGE),
                LOGS_TABLES[source].data.label(C.DATA),
                LOGS_TABLES[source].time.label(C.TIME),
                literal_column(f"'{source}'").label(C.SOURCE),
            )
            for source in (
                C.LOGS,
                'logs_error',
                'logs_url',
                'cod_logs',
                'cod_logs_error',
                'logs_ip',
            )
        )
        logs_request = tuple(
            db.query(LOGS_TABLES[source]).with_entities(
                LOGS_TABLES[source].id.label(C.ID),
                LOGS_TABLES[source].client.label(C.TARGET),
                LOGS_TABLES[source].path.label(C.MESSAGE),
                LOGS_TABLES[source].data.label(C.DATA),
                LOGS_TABLES[source].time.label(C.TIME),
                literal_column(f"'{source}'").label(C.SOURCE),
            )
            for source in (
                'logs_request',
                'logs_request_error',
                'logs_request_auth',
            )
        )
        logs = union(
            *(logs_basic + logs_request),
            db.query(LOGS_TABLES['cod_logs_search']).with_entities(
                LOGS_TABLES['cod_logs_search'].id.label(C.ID),
                LOGS_TABLES['cod_logs_search'].target.label(C.TARGET),
                LOGS_TABLES['cod_logs_search'].uno.label(C.MESSAGE),
                LOGS_TABLES['cod_logs_search'].data.label(C.DATA),
                LOGS_TABLES['cod_logs_search'].time.label(C.TIME),
                literal_column("'cod_logs_search'").label(C.SOURCE),
            ),
            db.query(LOGS_TABLES['cod_logs_task_queues']).with_entities(
                LOGS_TABLES['cod_logs_task_queues'].id.label(C.ID),
                LOGS_TABLES['cod_logs_task_queues'].name.label(C.TARGET),
                LOGS_TABLES['cod_logs_task_queues'].status.label(C.MESSAGE),
                LOGS_TABLES['cod_logs_task_queues'].data.label(C.DATA),
                LOGS_TABLES['cod_logs_task_queues'].time.label(C.TIME),
                literal_column("'cod_logs_task_queues'").label(C.SOURCE),
            ),
        ).alias()
        logs = (
            db.query(logs)
            .with_entities(
                logs.c.id,
                logs.c.target,
                logs.c.message,
                logs.c.data,
                logs.c.time,
                logs.c.source,
            )
            .order_by(logs.c.time.desc())
        )
    else:
        table = LOGS_TABLES[source]
        logs = db.query(table).order_by(table.time.desc())

    start = (page - 1) * settings.PAGE_LIMIT
    logs = logs.offset(start).limit(settings.PAGE_LIMIT).all()
    logs = list(map(to_dict, logs))

    return {C.LOGS: logs}


def log_delete(db: Session, source: LogsSourceOnly, log_id: int):
    table = LOGS_TABLES[source]
    log = db.query(table).filter(table.id == log_id).first()

    if log is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'[{source}] [{log_id}] {C.NOT_FOUND}'
        )

    db.delete(log)
    db.commit()

    return {C.MESSAGE: C.DELETED}


def logs_delete(db: Session, source: LogsSource):
    deleted_logs = 0

    tables = LOGS_TABLES.values() if source == C.ALL else [LOGS_TABLES[source]]

    for table in tables:
        deleted_logs += db.query(table).delete()
        set_table_sequence(db, table.__tablename__, 0)

    db.commit()

    return {C.MESSAGE: f'[{source}] {C.DELETED} {C.LOGS} [{deleted_logs}]'}


def logs_cache_get(source: LogsSourceCache, page: int) -> LogsResponse:
    start = (page - 1) * settings.PAGE_LIMIT
    stop = start + settings.PAGE_LIMIT
    page_logs = redis_manage(source, 'lrange', start, stop)

    return {C.LOGS: page_logs}


def logs_cache_delete(source: LogsSourceCache) -> Message:
    logs_count = redis_manage(source, 'llen')
    redis_manage(source, 'ltrim')

    return {C.MESSAGE: f'[{source}] {C.DELETED} {C.LOGS} [{logs_count}]'}


def roles_get(db: Session) -> UsersRoleResponse:
    roles = db.query(SBT.users_role).order_by(SBT.users_role.level).all()
    roles: list[UsersRole] = list(map(to_dict, roles))

    return {C.ROLES: roles}


def roles_post(db: Session, body: UsersRole) -> UsersRole | Error:
    table = SBT.users_role

    if db.query(table).filter(table.name == body.name).count():
        return json_error(status.HTTP_302_FOUND, f'[{body.name}] {C.ALREADY_EXIST}')

    new_role = table(
        id=get_last_id(db, table) + 1,
        name=body.name,
        level=body.level,
        access=body.access,
        pages=list(map(to_dict, body.pages)),
    )

    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    return to_dict(new_role)


def roles_put(db: Session, body: UsersRole) -> UsersRole | Error:
    table = SBT.users_role
    query = db.query(table).filter(table.id == body.id)
    role = query.first()

    if role is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'[{body.name}] [{body.id}] {C.NOT_FOUND}'
        )

    query.update(
        {
            table.name: body.name,
            table.level: body.level,
            table.access: body.access,
            table.pages: list(map(to_dict, body.pages)),
        }
    )
    db.commit()

    users_cache_set(db)

    role = to_dict(query.first())

    return role


def roles_delete(db: Session, body: UsersRole) -> UsersRole | Error:
    table = SBT.users_role
    role = db.query(table).filter(table.name == body.name).first()

    if role is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{body.name}] {C.NOT_FOUND}')

    res = to_dict(role)

    db.delete(role)
    db.commit()

    return res


def configs_get(db: Session) -> ConfigResponse:
    table = SBT.configs
    configs = db.query(table).order_by(table.id).all()
    configs = list(map(to_dict, configs))

    return {C.CONFIGS: configs}


def configs_post(db: Session, body: Config) -> Config | Error:
    table = SBT.configs
    config = (
        db.query(table)
        .filter(table.name == body.name, table.source == body.source)
        .first()
    )

    if config:
        return json_error(
            status.HTTP_302_FOUND, f'[{body.name}] [{body.source}] {C.ALREADY_EXIST}'
        )

    query = config_get(db, body.name, body.source)
    query.update({table.data: body.data})
    db.commit()

    config = to_dict(query.first())

    return config


def configs_put(db: Session, body: Config) -> Config | Error:
    table = SBT.configs
    query = db.query(table).filter(table.id == body.id)
    config = query.first()

    if config is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{body.name}] {C.NOT_FOUND}')

    if config.name != body.name:
        if db.query(table).filter(table.name == body.name).first():
            return json_error(status.HTTP_302_FOUND, f'[{body.name}] {C.ALREADY_EXIST}')

    query.update(
        {
            table.name: body.name,
            table.source: body.source,
            table.data: body.data,
        }
    )
    db.commit()

    config = to_dict(query.first())

    return config


def configs_delete(db: Session, body: Config) -> Config | Error:
    table = SBT.configs
    config = (
        db.query(table)
        .filter(table.name == body.name, table.source == body.source)
        .first()
    )

    if config is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{body.name}] {C.NOT_FOUND}')

    res = to_dict(config)

    db.delete(config)
    db.commit()

    return res


def check_alive(db: Session):
    return {
        C.STATUS: redis_manage(C.STATUS),
        C.MONITOR: manage_monitor(C.STATUS),
        C.LOGS: db.query(LOGS_TABLES[C.LOGS]).count(),
    }


def translate_store_get(db: Session):
    res: TranslatesStore = {'version': f'{now(C.EPOCH)}_'}

    for translate_type in Translate.__args__:
        table = SBT.__dict__[translate_type]
        translates = db.query(table).order_by(table.name).all()
        res[translate_type] = {
            translate.name: {C.EN: translate.en, C.RU: translate.ru}
            for translate in translates
        }
        res['version'] += str(len(translates))

    return res


def translate_version_check(db: Session, user_version: str):
    version: str | None = redis_manage(C.TRANSLATE)

    if version is None:
        version = translate_version_update(db)

    res: Status = {C.STATUS: version == user_version}

    return res


def translate_get(db: Session, translate_type: Translate):
    table = SBT.__dict__[translate_type]
    translate = db.query(table).order_by(table.id.desc()).all()
    translate = list(map(to_dict, translate))

    res: TranslatesResponse = {C.TRANSLATE: translate}

    return res


def translate_post(
    db: Session, translate_type: Translate, body: TranslatesWord
) -> TranslatesWord | Error:
    table = SBT.__dict__[translate_type]

    if word := db.query(table).filter(table.name == body.name).first():
        return json_error(
            status.HTTP_302_FOUND, f'[{translate_type}] [{body.name}] {C.ALREADY_EXIST}'
        )

    word = table(
        id=get_last_id(db, table) + 1,
        name=body.name,
        en=body.en,
        ru=body.ru,
    )
    db.add(word)
    db.commit()
    db.refresh(word)

    translate_version_update(db)

    return to_dict(word)


def translate_put(
    db: Session, translate_type: Translate, body: TranslatesWord
) -> TranslatesWord | Error:
    table = SBT.__dict__[translate_type]
    query = db.query(table).filter(table.id == body.id)
    word = query.first()

    if word is None:
        query = db.query(table).filter(table.name == body.name)
        word = query.first()
        if word is None:
            return json_error(
                status.HTTP_404_NOT_FOUND,
                f'[{translate_type}] [{body.name}] {C.NOT_FOUND}',
            )

    if word.name != body.name:
        if db.query(table).filter(table.name == body.name).first():
            return json_error(
                status.HTTP_302_FOUND,
                f'[{translate_type}] [{body.name}] {C.ALREADY_EXIST}',
            )

    query.update(to_dict(body))
    db.commit()

    word = to_dict(query.first())

    return word


def translate_delete(
    db: Session, translate_type: Translate, body: TranslatesWord
) -> TranslatesWord | Error:
    table = SBT.__dict__[translate_type]
    word = db.query(table).filter(table.id == body.id).first()

    if word is None:
        return json_error(
            status.HTTP_404_NOT_FOUND, f'[{translate_type}] [{body.id}] {C.NOT_FOUND}'
        )

    res = to_dict(word)

    db.delete(word)
    db.commit()

    return res
