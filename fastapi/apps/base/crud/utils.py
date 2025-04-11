from collections import defaultdict
import copy
import datetime
import re
import socket
import subprocess
import time
import traceback
from typing import Literal
from pathlib import Path
from functools import wraps
import redis
from jose import jwt
import bcrypt
import simplejson as json

from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse

from starlette.requests import Request

from core.config import settings
from core.database import get_db

from apps.base.crud.store_tables import SBT
from apps.base.crud.utils_data_init import LOGS_TABLES
from apps.base.models.main import Users
from apps.base.schemas.basic import AppType
from apps.base.schemas.main import (
    C,
    StatsRow,
    User,
    UsersPage,
    UsersRole,
    RequestData,
    RedisAction,
    RedisValue,
    Translate,
    RedisTarget,
    RedisTargetStatus,
    FormatDate,
    LogsBasic,
    LogsRequests,
    ConfigSource,
    ConfigName,
)

from apps.tracker.schemas.main import LogsTracker, BaseStats, GameMode


def date_format(input_time, strf: FormatDate = None) -> str | int | datetime.datetime:
    if not input_time:
        return 'no date'
    if isinstance(input_time, (datetime.datetime, datetime.date, datetime.time)):
        formated = input_time
    elif isinstance(input_time, (float, int)):
        formated = datetime.datetime.fromtimestamp(input_time, datetime.UTC)
    elif isinstance(input_time, str):
        if input_time.isdigit():
            return date_format(int(input_time), strf)

        if is_float(input_time.replace(',', '.')):
            return date_format(float(input_time), strf)

        try:
            formated = datetime.datetime.fromisoformat(input_time)
        except ValueError:
            return f'Invalid input string format: {input_time}'
    else:
        return f'Invalid input format: {type(input_time)} - {input_time}'

    if strf is None:
        pass
    elif strf == C.ISO:
        formated = formated.isoformat().replace('+00:00', 'Z')
    elif strf == C.EPOCH:
        formated = int(formated.timestamp())
    elif strf == C.TIME:
        formated = formated.strftime('%H:%M:%S')
        h, m, s = formated.split(':')
        if h == '00':
            formated = f'{m}:{s}'
    elif strf == C.DATETIME:
        formated = formated.strftime('%d/%m/%y, %H:%M:%S')
    elif strf == C.DATE:
        formated = formated.strftime('%Y-%m-%d')

    return formated


def now(strf: FormatDate = None):
    time_now = datetime.datetime.now(datetime.UTC)
    time_now = date_format(time_now, strf)
    return time_now


# def get_ago(raw_time) -> str:
#     if isinstance(raw_time, (datetime.time, datetime.datetime)):
#         return humanize.naturaltime(now() - raw_time.replace(tzinfo=pytz.utc))
#     if isinstance(raw_time, (float, int)):
#         return humanize.naturaltime(now(C.EPOCH) - raw_time)
#     if isinstance(raw_time, str):
#         if raw_time.isdigit() or is_float(raw_time):
#             return get_ago(float(raw_time))
#         return raw_time
#     return ''


def get_delay(
    value: int,
    time_type: Literal['seconds', 'minutes', 'hours', 'days'],
    to_seconds=False,
):
    switch_case = {
        'seconds': datetime.timedelta(seconds=value),
        'minutes': datetime.timedelta(minutes=value),
        'hours': datetime.timedelta(hours=value),
        'days': datetime.timedelta(days=value),
    }
    time_delta = switch_case[time_type]
    if to_seconds:
        return time_delta.total_seconds()
    return time_delta


def duration_to_seconds(duration):
    if isinstance(duration, str):
        hours, minutes, seconds = list(map(int, duration.split(':')))
        return int(
            datetime.timedelta(
                hours=hours, minutes=minutes, seconds=seconds
            ).total_seconds()
        )

    return 0


def is_float(s: str):
    return s.count('.') == 1 and s.replace('.', '').isdigit()


def seconds_wait_expire(
    date: datetime.datetime | str | None, delay: datetime.timedelta
) -> int:
    if not date:
        date = now()
    elif isinstance(date, str):
        date = date_format(date)
    expire_epoch_date = (date + delay).timestamp()
    seconds_left = int(expire_epoch_date - now(C.EPOCH))

    return seconds_left if seconds_left > 0 else 0


def log_exceptions_wrap(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            settings.LOGGING.error(
                '%s\nException %s occurred in %s\n%s',
                traceback.format_exc(),
                type(e).__name__,
                func.__name__,
                args,
            )
            raise

    return wrapper


def log_time_wrap(func):
    @wraps(func)
    def time_taken_wrap(*args, **kwargs):
        start = time.perf_counter()
        db: Session = args[0]
        try:
            return func(*args, **kwargs)
        except Exception as e:
            db.rollback()
            in_logs(
                func.__name__,
                type(e).__name__,
                'logs_error',
                {'trace': traceback.format_exc()},
            )
            return json_error(status.HTTP_405_METHOD_NOT_ALLOWED, type(e).__name__)
        finally:
            time_taken = time_taken_get(start)
            print(
                func.__name__,
                f'{C.TIME} taken {time_taken}',
            )
            in_logs(func.__name__, time_taken, C.LOGS)

    return time_taken_wrap


def to_dict(obj):
    dictionary = {}

    if hasattr(obj, '_asdict'):
        dictionary: dict = obj._asdict()
    elif str(type(obj)) == "<class 'sqlalchemy.util._collections.result'>":
        dictionary = dict(zip(obj.keys(), obj))
    elif isinstance(obj, str):
        try:
            dictionary = json.loads(obj)
        except Exception:
            pass
    else:
        try:
            dictionary = copy.deepcopy(dict(obj.__dict__))
        except Exception:
            pass

    if '_sa_instance_state' in dictionary:
        del dictionary['_sa_instance_state']

    return dictionary or obj


def hash_password(password: str) -> bytes:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode()
    return hashed


def is_valid_password(password: str, hashed_password: str) -> bool:
    hashed_password: bytes = bytes(hashed_password, 'utf-8')
    valid = bcrypt.checkpw(password.encode('utf-8'), hashed_password)
    return valid


def token_decode(token: str | None):
    if token in (None, C.GUEST):
        return C.GUEST

    try:
        payload = jwt.decode(
            token, settings.ADMIN_PASSWORD, 'HS256', {'verify_aud': False}
        )
        login: str = payload.get(C.LOGIN) or C.GUEST
        return login
    except Exception as e:
        if str(e) == 'Signature has expired.':
            return 'expired'
        return 'invalid'


def token_encode(login: str) -> str:
    time_now = now()
    payload = {
        'type': C.TOKEN,
        'exp': time_now + settings.TOKEN_EXPIRE_DAYS,
        'iat': time_now,
        C.LOGIN: login,
    }
    token = jwt.encode(payload, settings.ADMIN_PASSWORD, 'HS256')

    return token


def get_required_path_role(db: Session):
    roles: list[UsersRole] = db.query(SBT.users_role).all()
    required_path_role: dict[str, str] = {
        path: role.name for role in roles for path in role.access
    }
    return required_path_role


def verify_token(request: Request):
    if hasattr(verify_token, 'cache') is False:
        with next(get_db()) as db:
            verify_token.cache = get_required_path_role(db)
            verify_token.fail_counter = defaultdict(int)

    login = token_decode(request.headers.get(C.TOKEN))

    if login in (C.GUEST, 'expired', 'invalid'):
        in_logs_request(request, 'logs_request_error', {C.ERROR: f'{login=}'})
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f'{login} {C.TOKEN}')

    user_roles: list[str] | None = redis_manage(f'{C.USER}:{login}', 'hget', C.ROLES)

    if user_roles is None:
        in_logs_request(
            request, 'logs_request_error', {C.ERROR: f'{C.USER} {C.NOT_FOUND}'}
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f'{C.USER} {C.NOT_FOUND}')

    path = request['path'].split('/')[3]
    required_role = verify_token.cache.get(path)

    if required_role is None:
        if verify_token.fail_counter[path] < 3:
            # refill cache, check if new role was added
            with next(get_db()) as db:
                verify_token.cache = get_required_path_role(db)

        required_role = verify_token.cache.get(path)
        error = f'path [{path}] {C.NOT_FOUND}'

        in_logs_request(
            request,
            'logs_request_error',
            {
                C.ERROR: f'{error} {required_role=}\
                fail_counter: {verify_token.fail_counter[path]}'
            },
        )

        if required_role is None:
            verify_token.fail_counter[path] += 1
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, error)

        verify_token.fail_counter[path] = 0

    if required_role not in user_roles:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            f'{C.ROLES} {", ".join(user_roles)} not allowed',
        )


def format_request(request: Request) -> RequestData:
    client = request.headers.get('x-forwarded-for') or ''

    if not client and request.client:
        client = request.client.host

    return {
        'path': request.get('path'),
        'client': client,
        C.LOGIN: token_decode(request.headers.get(C.TOKEN)),
        'user_agent': request.headers.get('user-agent'),
    }


def get_data(url: str | Path):
    start = time.perf_counter()
    data = {}
    res = None
    error = None

    try:
        if isinstance(url, str):
            res = settings.SESSION.get(url)
            data = res.json()
        elif url.exists():
            with open(url, 'r', encoding='utf8') as file:
                data = json.load(file)
        else:
            error = f'file {C.NOT_FOUND}'
    except Exception as e:
        if res is None:
            error = 'no response'
        elif 'unexpected error' in res.text:
            error = 'unexpected error'
        elif '404 Not Found' in res.text:
            error = C.NOT_FOUND
        else:
            error = res.text
        error = f'{e}: {error}'

    res = {
        C.DATA: data,
        C.ERROR: error,
        'url': url,
        C.TIME_TAKEN: time_taken_get(start),
    }

    in_logs(
        res[C.TIME_TAKEN], str(url), 'logs_url', {C.ERROR: error} if error else None
    )

    return res


def time_taken_get(start: float):
    time_taken = f'{(time.perf_counter() - start):.02f}'
    seconds, milliseconds = tuple(map(int, time_taken.split('.')))

    if milliseconds == 0:
        return f'{seconds} seconds'

    if milliseconds % 10 == 0:
        milliseconds = int(milliseconds / 10)

    return f'{seconds}.{milliseconds} seconds'


def json_error(status_code: int, message: str):
    return JSONResponse({C.DETAIL: message}, status_code)


# async def post_data(db: Session, path: str, body: dict, sleep: int):
#     await asyncio.sleep(sleep)
#     start = time.perf_counter()

#     data = {}
#     error = None
#     res = None
#     headers = {
#         'Content-Type': 'application/json',
#         C.TOKEN: GUEST
#     }
#     url = f'http://{settings.STATIC_IPS[0]}/{settings.FASTAPI_API_PATH}/{path}'
#     db.add(SBT.logs_url(
#         target=url,
#         message=res[C.TIME_TAKEN],
#         data={C.ERROR: error} if error else None
#     ))
#     db.commit()
#     try:
#         res = await asyncio.to_thread(
#             settings.SESSION.post, url, json=body, headers=headers
#         )
#         res.raise_for_status()  # raises an exception for 4xx and 5xx status codes
#         data = res.json()
#     except Exception as e:
#         error = f'post error {type(e).__name__} {url}'
#         in_logs(
#             path, error, 'logs_error',
#             {
#                 'res': res.text if res else body,
#                 'trace': traceback.format_exc()
#             }
#         )
#     finally:
#         in_logs(path, f'post [{time_taken_get(start)}]', C.LOGS)

#     return {
#         C.DATA: data,
#         C.ERROR: error,
#         TIME_TAKEN: time_taken
#     }


def config_get(db: Session, name: ConfigName, source: ConfigSource):
    '''Select row by name from config table'''

    table = SBT.configs
    query = db.query(table).filter(table.name == name, table.source == source)

    if query.count() == 0:
        config = table(id=get_last_id(db, table) + 1, name=name, source=source)
        db.add(config)
        db.commit()

    return query


def get_base_stats(db: Session):
    stats: BaseStats = config_get(db, C.STATS, C.BASE).first()

    if not stats.data or not seconds_wait_expire(
        stats.time, settings.STATS_INTERVAL_WEEKS
    ):
        stats = update_base_stats(db)
    else:
        stats = to_dict(stats)

    return stats


@log_time_wrap
def update_base_stats(db: Session):
    '''Count and save rows for every table, with last added id'''

    data = {
        name: {
            C.ROWS: db.query(base_table).count(),
            'last_id': get_last_id(db, base_table),
        }
        for name, base_table in SBT.__dict__.items()
    }
    config_get(db, C.STATS, C.BASE).update({SBT.configs.data: data})
    db.commit()

    return {C.DATA: data, C.TIME: now(C.ISO)}


def in_logs_request(
    request: Request,
    source: LogsRequests,
    data: dict,
):
    formated_request = format_request(request)

    if is_local_ip(formated_request['client']) and not data:
        return

    data[C.LOGIN] = data.get(C.LOGIN) or formated_request[C.LOGIN]

    with next(get_db()) as db:
        data['ip'] = get_ip_data(db, formated_request['client'])
        table = LOGS_TABLES[source]
        log = table(
            client=formated_request['client'] or formated_request[C.LOGIN],
            path=formated_request['path'],
            user_agent=formated_request['user_agent'],
            data=data,
        )
        db.add(log)
        db.commit()


def in_logs_ip(db: Session, ip: str):
    data = get_data(f'http://ip-api.com/json/{ip}')
    if data[C.ERROR]:
        data = {C.STATUS: 'fail', C.MESSAGE: data[C.ERROR]}
    else:
        data = data[C.DATA]

    # if 'query' in data:
    #     del data['query']

    table = LOGS_TABLES['logs_ip']
    db.add(table(target=ip, message='', data=data))

    return data


def get_ip_data(db: Session, ip: str):
    if hasattr(get_ip_data, 'cache') is False:
        get_ip_data.cache = {}
    elif get_ip_data.cache.get(ip):
        return get_ip_data.cache[ip]

    table = LOGS_TABLES['logs_ip']

    if is_local_ip(ip):
        data = {C.STATUS: 'fail', C.MESSAGE: 'private range'}
    elif have := db.query(table.data).filter(table.target == ip).first():
        data = have.data
    else:
        data = in_logs_ip(db, ip)

    get_ip_data.cache[ip] = data

    return get_ip_data.cache[ip]


def is_local_ip(ip) -> bool:
    '''Check if an IP address is a local address'''

    if isinstance(ip, str) is False:
        return False

    if ip in ['', 'testclient', C.GUEST] + settings.STATIC_IPS:
        return True

    if (
        ip.startswith('127.')
        or ip.startswith('10.')
        or ip.startswith('172.')
        or ip.startswith('192.168.')
    ):
        return True

    try:
        socket.inet_aton(ip)
        return False
    except socket.error:
        return False


@log_exceptions_wrap
def in_logs(
    target: str,
    message: str,
    source: LogsBasic,
    data: dict | None = None,
) -> None:
    message = f'fastapi {message}'
    table = LOGS_TABLES[source]
    row = table(target=target, message=message)
    if data:
        row.data = data

    with next(get_db()) as db:
        db.add(row)
        db.commit()


def get_last_id(db: Session, table) -> int:
    last_id = db.query(table.id)
    last_id = last_id.order_by(table.id.desc()).first()
    last_id: int = last_id.id if last_id else 0

    return last_id


def set_table_sequence(db: Session, table_name: str, id_seq: int | None = None):
    table_seq = f'{table_name}_id_seq'
    if id_seq is None:
        sql = f"SELECT setval('{table_seq}', MAX(id)) FROM {table_name}"
    elif id_seq == 0:
        sql = f'ALTER SEQUENCE {table_seq} RESTART WITH 1'
    else:
        sql = f"SELECT setval('{table_seq}', {id_seq}, true)"

    db.execute(text(sql))
    db.commit()


def is_number(value):
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str) and value.isdigit():
        return True
    return False


def redis_value_set(value):
    if value is None:
        pass
    elif isinstance(value, bytes):
        pass
    if isinstance(value, (str, int)) is False:
        value = json.dumps(value)
        # return pickle.dumps(value).hex()

    return value


def redis_value_get(value: bytes | None):
    if value is None:
        return value

    try:
        decoded_object = json.loads(value)
        # decoded_object = pickle.loads(value)
        if isinstance(decoded_object, int):
            return value.decode()
        return decoded_object
    except Exception:
        return value.decode()


@log_exceptions_wrap
def redis_manage(
    target: RedisTarget,
    action: RedisAction = 'get',
    value: RedisValue | list[RedisValue] = 0,
    index=0,
):
    conn = redis.Redis(connection_pool=settings.REDIS_CONNECTION_POOL)
    res: RedisValue | list[RedisValue] | None = None

    if action == 'get':
        get = conn.get(target)
        res = redis_value_get(get)

    elif action == 'set':
        res = conn.set(target, redis_value_set(value))

    elif action == 'lpush':
        value = list(map(redis_value_set, value))
        res = conn.lpush(target, *value)

    elif action == 'rpush':
        value = list(map(redis_value_set, value))
        res = conn.rpush(target, *value)

    elif action == 'lrange':
        start = value
        stop = index - 1
        lrange = conn.lrange(target, start, stop)
        res = list(map(redis_value_get, lrange))

    elif action == 'lindex':
        lindex = conn.lindex(target, value)
        res = redis_value_get(lindex)

    elif action == 'lpop':
        lpop = conn.lpop(target)
        res = redis_value_get(lpop)

    elif action == 'llen':
        res = conn.llen(target)

    elif action == 'lset':
        res = conn.lset(target, index, redis_value_set(value))

    elif action == 'ltrim':
        start_index = 0 if value else 1
        res = conn.ltrim(target, start_index, value)

    elif action == 'lrem':
        res = conn.lrem(target, index, redis_value_set(value))

    elif action == 'hset':
        for k, v in value.items():
            res = conn.hset(target, k, redis_value_set(v))

    elif action == 'hget':
        hget = conn.hget(target, value)
        res = redis_value_get(hget)

    elif action == 'hmget':
        hmget = conn.hmget(target, value)
        res = list(map(redis_value_get, hmget))

    elif action == 'hdel':
        res = conn.hdel(target, value)

    elif action == 'hkeys':
        hkeys = conn.hkeys(target)
        res = [i.decode() for i in hkeys]

    elif action == 'hgetall':
        hgetall = conn.hgetall(target)
        if hgetall:
            res = {k.decode(): redis_value_get(v) for k, v in hgetall.items()}

    elif action == C.DELETE:
        if '*' in target:
            deleted_count = 0
            for key in conn.scan_iter(target):
                conn.delete(key)
                deleted_count += 1
            res = deleted_count
        else:
            res = conn.delete(target)

    elif action == 'keys':
        keys = conn.keys(target)
        res = [i.decode() for i in keys]

    elif action == 'flushall':
        res = conn.flushall()

    conn.close()

    return res


def in_logs_cod_logs_cache(target: str, game_mode: GameMode, message: str):
    LIMIT = settings.LOGS_CACHE_LIMIT
    log: LogsTracker = {
        C.TARGET: f'[{target}]' if target.isdigit() else target,
        C.GAME_MODE: game_mode,
        C.MESSAGE: message,
        C.TIME: now(C.ISO),
    }
    added_index = redis_manage('cod_logs_cache', 'lpush', [log])
    if added_index > LIMIT + (LIMIT / 4):  # keeping logs under limit
        redis_manage('cod_logs_cache', 'ltrim', LIMIT)


def user_cache_set(
    db: Session, user: Users, roles: list[UsersRole] | None = None
) -> User:
    roles = roles or db.query(SBT.users_role).all()
    role_pages: dict[str, list[UsersPage]] = {role.name: role.pages for role in roles}
    role_names: list[str] = [role.name for role in roles]
    roles_not_valid = [role for role in user.roles if role not in role_names]

    if roles_not_valid:
        user.roles = [role for role in user.roles if role in role_names]
        db.query(SBT.users).filter(SBT.users.login == user.login).update(
            {SBT.users.roles: user.roles}
        )
        db.commit()
        in_logs(
            user.login,
            f'{C.ROLES} {C.DELETED} {roles_not_valid}',
            'cod_logs_user',
        )

    user.pages = [page for role in user.roles for page in role_pages[role]]
    user.token = ''
    user.time = date_format(user.time, C.ISO)
    user = to_dict(user)
    redis_manage(f'{C.USER}:{user[C.LOGIN]}', 'hset', user)

    return user


def users_cache_set(db: Session):
    roles: list[UsersRole] = db.query(SBT.users_role).all()
    _users: list[Users] = db.query(SBT.users).all()

    for user in _users:
        user_cache_set(db, user, roles)


def get_message_response(res: dict | JSONResponse):
    if isinstance(res, dict):
        return res.get(C.MESSAGE) or str(res)
    body = to_dict(res.body.decode())
    return body[C.DETAIL]


def manage_service(name: AppType, action: str):
    if name == 'fastapi':
        service = settings.FASTAPI_APP_NAME
    elif name == 'nextjs':
        service = settings.NEXTJS_APP_NAME
    else:
        return

    # status = os.system(f'systemctl {action} {service}')
    # os.chdir(Path.cwd().parent)
    # os.system(f'./start.sh fastapi {action} close')

    try:
        service_status = subprocess.run(
            ['systemctl', action, service], capture_output=True, text=True, check=False
        ).stdout.strip()
    except subprocess.CalledProcessError:
        service_status = C.ERROR

    settings.LOGGING.warning(f'{action} {name} {service_status=}')

    return service_status


def socket_send_message(message: str):
    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    res = None

    try:
        client_socket.connect(
            (settings.FASTAPI_MONITOR_HOST, settings.FASTAPI_MONITOR_PORT)
        )
        client_socket.sendall(message.encode())
        res = client_socket.recv(1024).decode()
    except Exception as e:
        settings.LOGGING.error(f'{socket_send_message.__name__} [{e}] - {message=}')
    finally:
        client_socket.close()

    return res


def get_status(name: RedisTargetStatus) -> bool:
    redis_status = redis_manage(name)
    return redis_status in (1, '1')


def manage_monitor(action: Literal['status', 'start', 'stop', 'time']):
    if action == C.STATUS:
        return socket_send_message('ping') == 'pong'

    if action == C.TIME:
        return socket_send_message(action)

    if action == 'start':
        if manage_monitor(C.STATUS) is False:
            monitor = subprocess.Popen(['python3', settings.FASTAPI_MONITOR_NAME])
            settings.LOGGING.warning(f'{action} {C.MONITOR} [{monitor.pid}]')
    elif action == 'stop':
        if socket_send_message(action) == 'stopping':
            return
        # if monitor_pid := redis_manage(C.MONITOR):
        #     os.kill(int(monitor_pid), signal.SIGTERM)


def is_email(email: str | None):
    if not email:
        return False

    regex = re.compile(
        r'([A-Za-z0-9]+[.-_])*[A-Za-z0-9]+@[A-Za-z0-9-]+(\.[A-Z|a-z]{2,})+'
    )

    return bool(re.fullmatch(regex, email))


# def is_letters(text: str | None):
#     if isinstance(text, str) is False:
#         return False

#     regex = re.compile(r'^[а-яА-Яa-zA-Z\-]+$')

#     if text and not regex.match(text):
#         return False

#     return True


def validate_login(initial_login: str):
    error = None
    login = initial_login.lower()

    if login in (C.ADMIN, C.USER, C.GUEST):
        error = f'{C.LOGIN} [{initial_login}] forbiden'

    return error


def translate_version_update(db: Session):
    version = ''

    for translate_type in Translate.__args__:
        table = SBT.__dict__[translate_type]
        version += str(db.query(table).count())

    redis_manage(C.TRANSLATE, 'set', version)

    return version


def get_stats_row(db: Session, table: object | None) -> StatsRow:
    if table is None:
        return {C.ROWS: 0, 'last_id': 0}

    return {C.ROWS: db.query(table).count(), 'last_id': get_last_id(db, table)}
