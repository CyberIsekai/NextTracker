# pylint: disable=redefined-outer-name

import pytest

from fastapi import status

from core.config import settings
from core.database import get_db

from apps.base.tests.store import TS
from apps.base.crud.utils_data_init import LOGS_TABLES
from apps.base.schemas.main import C, STask, LogsSourceOnly, LogsRequest, LogsUniversal
from apps.base.crud.utils import now, to_dict


@pytest.fixture(scope='session')
def f_logs():
    '''fixture: Test logs'''

    LOG_UNIVERSAL_BASIC: LogsUniversal = {C.TARGET: 'test', C.MESSAGE: 'test'}
    LOG_UNIVERSAL_REQUEST: LogsRequest = {
        'client': 'testclient',
        'path': 'tests',
        'user_agent': 'pytest',
        C.DATA: {'test': 'test'},
    }

    logs: dict[LogsSourceOnly, dict] = {
        # LogsBasic
        C.LOGS: LOG_UNIVERSAL_BASIC,
        'logs_user': LOG_UNIVERSAL_BASIC,
        'logs_error': LOG_UNIVERSAL_BASIC,
        'cod_logs': LOG_UNIVERSAL_BASIC,
        'cod_logs_player': LOG_UNIVERSAL_BASIC,
        'cod_logs_error': LOG_UNIVERSAL_BASIC,
        'logs_url': {C.TARGET: '127.0.0.1', C.MESSAGE: 'test', C.DATA: None},
        'logs_ip': {
            C.TARGET: '127.0.0.1',
            C.MESSAGE: '',
            C.DATA: {C.STATUS: 'fail', C.MESSAGE: 'test'},
        },
        # LogsRequests
        'logs_request': LOG_UNIVERSAL_REQUEST,
        'logs_request_error': LOG_UNIVERSAL_REQUEST,
        'logs_request_auth': LOG_UNIVERSAL_REQUEST,
        # other
        'cod_logs_search': {C.TARGET: 'test', C.UNO: TS.NON_EXIST_ID, C.DATA: {}},
        'cod_logs_task_queues': {
            C.NAME: f"['test', '{C.MW_MP}', '{C.MATCHES}']",
            C.STATUS: STask.COMPLETED,
            C.DATA: {
                C.GAME: C.MW,
                C.MODE: C.WZ,
                C.GROUP: settings.TEST_GROUP,
                C.SOURCE: 'tests',
                C.STATUS: STask.COMPLETED,
                C.TARGET: '-1',
                C.MESSAGE: f'{C.USERNAME} | {C.MW} | {C.WZ} | {C.MATCHES} ',
                C.USERNAME: C.USERNAME,
                C.DATA_TYPE: C.MATCHES,
                'validated': C.USERNAME,
                'caller_func': 'tests_store',
            },
            C.TIME: now(),
            'time_started': now(),
            'time_end': now(),
        },
    }

    with next(get_db()) as db:
        # add every log to table and save fresh added log data
        for source, log in logs.items():
            table = LOGS_TABLES[source]
            new_log = table()
            new_log.__dict__.update(log)
            db.add(new_log)
            db.commit()
            db.refresh(new_log)
            logs[source] = to_dict(new_log)

    return logs


def test_logs_get(f_logs: dict[LogsSourceOnly, dict]):
    TS.set_role_token(C.USER)

    logs_sources = list(f_logs)

    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/logs/{logs_sources[0]}/1')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_logs_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)

    for log_name in logs_sources:
        resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/logs/{log_name}/1')
        TS.check_response(resp, status.HTTP_200_OK, test_logs_get.__name__)


def test_log_delete(f_logs: dict[LogsSourceOnly, dict]):
    TS.set_role_token(C.ADMIN)

    log_name = TS.NON_EXIST_ID
    logs_source = 'logs_request'
    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/logs/{logs_source}/{log_name}')
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_log_delete.__name__,
        (C.DETAIL, f'[{logs_source}] [{TS.NON_EXIST_ID}] {C.NOT_FOUND}'),
    )

    for logs_source, log_data in f_logs.items():
        resp = TS.client.delete(
            f'{TS.FASTAPI_API_PATH}/logs/{logs_source}/{log_data[C.ID]}'
        )
        TS.check_response(
            resp,
            status.HTTP_200_OK,
            test_log_delete.__name__,
            (C.MESSAGE, C.DELETED),
            log_data,
        )


def test_logs_delete():
    TS.set_role_token(C.ADMIN)

    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/logs/{TS.NON_EXIST_NAME}')
    TS.check_response(
        resp, status.HTTP_422_UNPROCESSABLE_ENTITY, test_logs_delete.__name__
    )

    resp = TS.client.delete(f'{TS.FASTAPI_API_PATH}/logs/logs_request')
    TS.check_response(resp, status.HTTP_200_OK, test_logs_delete.__name__)
