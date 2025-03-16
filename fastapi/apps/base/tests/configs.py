# pylint: disable=redefined-outer-name

import copy
import pytest

from fastapi import status

from core.database import get_db

from apps.base.tests.store import TS
from apps.base.crud.store_tables import SBT
from apps.base.schemas.main import C, M, Config
from apps.base.crud.utils import date_format, to_dict, get_last_id


@pytest.fixture(scope='session')
def f_config() -> Config:
    '''fixture: Test config'''

    # delete and recreate test config
    with next(get_db()) as db:
        table = SBT.configs
        config = table(
            id=get_last_id(db, table) + 1,
            name=f'test_{C.STATS}',
            source=C.BASE,
            data={'test': C.STATS},
        )
        db.query(table).filter(table.name == config.name).delete()
        db.add(config)
        db.commit()
        db.refresh(config)
        config.time = date_format(config.time, C.ISO)

    return to_dict(config)


def test_configs_get():
    TS.set_role_token(C.USER)

    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/configs')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_configs_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/configs')
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_configs_get.__name__,
    )


def test_configs_post(f_config: Config):
    TS.set_role_token(C.ADMIN)

    f_config = copy.copy(f_config)
    f_config[C.SOURCE] = C.TRACKER

    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/configs', json=f_config)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_configs_post.__name__,
        (C.NAME, f_config[C.NAME]),
    )

    # post again
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/configs', json=f_config)
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_configs_post.__name__,
        (
            C.DETAIL,
            f'[{f_config[C.NAME]}] [{f_config[C.SOURCE]}] {C.ALREADY_EXIST}',
        ),
    )


def test_configs_put(f_config: Config):
    TS.set_role_token(C.ADMIN)

    f_config = copy.copy(f_config)
    f_config[C.DATA] = {'new_test': 'new_test'}

    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/configs', json=f_config)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_configs_put.__name__,
        (C.DATA, f_config[C.DATA]),
    )

    # try put config with non exist id
    f_config[C.ID] = TS.NON_EXIST_ID
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/configs', json=f_config)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_configs_put.__name__,
        (C.DETAIL, f'[{f_config[C.NAME]}] {C.NOT_FOUND}'),
    )


def test_configs_delete(f_config: Config):
    TS.set_role_token(C.ADMIN)

    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/configs', json=f_config)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_configs_delete.__name__,
        (C.NAME, f_config[C.NAME]),
        f_config,
    )

    # try delete again
    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/configs', json=f_config)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_configs_delete.__name__,
        (C.DETAIL, f'[{f_config[C.NAME]}] {C.NOT_FOUND}'),
        f_config,
    )
