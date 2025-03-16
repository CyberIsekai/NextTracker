import datetime
import logging
import os
from pathlib import Path
from typing import Optional
from redis import ConnectionPool
from pydantic import PostgresDsn, field_validator
from pydantic_settings import BaseSettings
from pydantic_core import MultiHostUrl
from dotenv import load_dotenv
import requests
from apps.base.schemas.basic import Language

load_dotenv()


class Settings(BaseSettings):
    FASTAPI_API_PATH: str = os.getenv('FASTAPI_API_PATH')

    NEXTJS_APP_NAME: str = os.getenv('NEXTJS_APP_NAME')
    FASTAPI_APP_NAME: str = os.getenv('FASTAPI_APP_NAME')

    ADMIN_LOGIN: str = os.getenv('ADMIN_LOGIN')
    ADMIN_PASSWORD: str = os.getenv('ADMIN_PASSWORD')

    GUNICORN_WORKERS: int = int(os.getenv('GUNICORN_WORKERS'))

    NEXTJS_PORT: int = int(os.getenv('NEXTJS_PORT'))

    FASTAPI_HOST: str = os.getenv('FASTAPI_HOST')
    FASTAPI_PORT: int = int(os.getenv('FASTAPI_PORT'))

    FASTAPI_MONITOR_NAME: str = os.getenv('FASTAPI_MONITOR_NAME')
    FASTAPI_MONITOR_HOST: str = os.getenv('FASTAPI_MONITOR_HOST')
    FASTAPI_MONITOR_PORT: int = int(os.getenv('FASTAPI_MONITOR_PORT'))

    TOKEN_EXPIRE_DAYS: datetime.timedelta = datetime.timedelta(
        days=int(os.getenv('TOKEN_EXPIRE'))
    )
    STATIC_IPS: list[str] = []
    LANGUAGES: tuple[str, ...] = Language.__args__

    TEST_GROUP: str = os.getenv('TEST_GROUP')

    NAME_LIMIT: int = int(os.getenv('NAME_LIMIT'))
    NAME_LIMIT_2: int = int(os.getenv('NAME_LIMIT_2'))

    PASSWORD_LENGTH_REQUIRED: int = int(os.getenv('PASSWORD_LENGTH_REQUIRED'))
    PASSWORD_LENGTH_LIMIT: int = int(os.getenv('PASSWORD_LENGTH_LIMIT'))

    LOGIN_LENGTH_REQUIRED: int = int(os.getenv('LOGIN_LENGTH_REQUIRED'))
    LOGIN_LENGTH_LIMIT: int = int(os.getenv('LOGIN_LENGTH_LIMIT'))

    GROUP_NAME_LENGTH_REQUIRED: int = int(os.getenv('GROUP_NAME_LENGTH_REQUIRED'))
    GROUP_NAME_LENGTH_LIMIT: int = int(os.getenv('GROUP_NAME_LENGTH_LIMIT'))

    PARS_PRE_LIMIT: int = int(os.getenv('PARS_PRE_LIMIT'))
    MATCHES_LIMIT: int = int(os.getenv('MATCHES_LIMIT'))
    PAGE_LIMIT: int = int(os.getenv('PAGE_LIMIT'))

    LOGS_GAMES_LIMIT: int = int(os.getenv('LOGS_GAMES_LIMIT'))
    LOGS_CACHE_LIMIT: int = int(os.getenv('LOGS_CACHE_LIMIT'))

    AUTO_UPDATE_INTERVAL_DAYS: datetime.timedelta = datetime.timedelta(
        days=int(os.getenv('AUTO_UPDATE_INTERVAL'))
    )
    TASK_QUEUES_INTERVAL_SECONDS: datetime.timedelta = datetime.timedelta(
        seconds=int(os.getenv('TASK_QUEUES_INTERVAL'))
    )
    STATS_INTERVAL_WEEKS: datetime.timedelta = datetime.timedelta(
        weeks=int(os.getenv('STATS_INTERVAL'))
    )
    MATCHES_INTERVAL_MINUTES: datetime.timedelta = datetime.timedelta(
        minutes=int(os.getenv('MATCHES_INTERVAL'))
    )

    SQLALCHEMY_DATABASE_URI: Optional[MultiHostUrl] = None
    REDIS_CONNECTION_POOL: Optional[ConnectionPool] = None
    SESSION: Optional[requests.Session] = None

    LOGGING: Optional[logging.Logger] = None

    @field_validator('SQLALCHEMY_DATABASE_URI')
    def assemble_connection_db(cls, _):
        return PostgresDsn.build(
            scheme='postgresql',
            host=os.getenv('DATABASE_HOST'),
            port=int(os.getenv('DATABASE_PORT')),
            path=os.getenv('DATABASE_NAME'),
            username=os.getenv('DATABASE_USER'),
            password=os.getenv('DATABASE_PASSWORD'),
        )

    @field_validator('REDIS_CONNECTION_POOL')
    def assemble_connection_redis(cls, _):
        return ConnectionPool(host='localhost', port=6379, db=0, decode_responses=False)

    @field_validator('SESSION')
    def assemble_session(cls, _):
        session = requests.Session()
        session.headers.update(
            {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0'
            }
        )
        session.cookies.update(
            requests.utils.cookiejar_from_dict(
                {
                    'ACT_SSO_COOKIE': os.getenv('ACT_SSO_COOKIE') or '',
                    'ACT_SSO_COOKIE_EXPIRY': '1685381133410',
                    'ACT_SSO_EVENT': '"LOGIN_SUCCESS:1684171533621"',
                    'API_CSRF_TOKEN': 'c431a006-33d5-418c-aeed-557de4195ae7',
                    'ssoDevId': 'ab4621ab166a425eb8371fb6e7838eae',
                    'tfa_enrollment_seen': 'true',
                }
            )
        )
        return session

    @field_validator('LOGGING')
    def assemble_logging(cls, _):
        logs_folder = Path.cwd().parent / 'logs'
        if logs_folder.exists() is False:
            logs_folder.mkdir()

        file_path = logs_folder / 'fastapi_logs.log'
        handler = logging.FileHandler(file_path)
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(module)s - %(levelname)s - %(funcName)s: %(message)s',
            datefmt='%d/%m/%y, %H:%M:%S',
        )
        handler.setFormatter(formatter)
        logs = logging.getLogger('logs')
        logs.setLevel(logging.WARNING)
        logs.addHandler(handler)

        return logs

    @field_validator('STATIC_IPS')
    def assemble_static_ips(cls, _):
        static_ips = [
            os.getenv('STATIC_IP'),
            os.getenv('STATIC_IP_2'),
            os.getenv('STATIC_IP_3'),
        ]
        static_ips = [i for i in static_ips if i]
        static_ips += [f"{i}:{os.getenv('NEXTJS_PORT')}" for i in static_ips]
        return static_ips

    class Config:
        case_sensitive = True


settings = Settings()
