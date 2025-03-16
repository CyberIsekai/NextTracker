# pylint: disable=redefined-outer-name

import copy
import pytest

from fastapi import status

from core.database import get_db

from apps.base.tests.store import TS
from apps.base.crud.store_tables import SBT
from apps.base.schemas.main import C, M, UsersRole, UsersPage
from apps.base.crud.utils import to_dict
from apps.base.crud.main import roles_post


@pytest.fixture(scope='session')
def f_role() -> UsersRole:
    '''fixture: Test role'''

    role = UsersRole(
        id=-1,
        name='test',
        level=0,
        access=['test', 'path', 'test/path'],
        pages=[
            UsersPage(
                name='TestPage', path='/testpage', sub_pages=['test', 'sub', 'page']
            ),
            UsersPage(
                name='TestPage2',
                path='/testpage2',
                sub_pages=['test2', 'sub2', 'page2'],
            ),
        ],
    )

    # delete and recreate test role
    with next(get_db()) as db:
        table = SBT.users_role
        db.query(table).filter(table.name.in_((role.name, role.name + '2'))).delete()
        role = roles_post(db, role)

    return role


def test_roles_get():
    TS.set_role_token(C.USER)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/roles')

    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_roles_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/roles')
    TS.check_response(resp, status.HTTP_200_OK, test_roles_get.__name__)


def test_roles_post(f_role: UsersRole):
    TS.set_role_token(C.ADMIN)
    f_role = copy.copy(f_role)

    f_role[C.NAME] += '2'
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/roles', json=f_role)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_roles_post.__name__,
        (C.NAME, f_role[C.NAME]),
    )

    # post again
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/roles', json=f_role)
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_roles_post.__name__,
        (C.DETAIL, f'[{f_role[C.NAME]}] {C.ALREADY_EXIST}'),
    )


def test_roles_put(f_role: UsersRole):
    TS.set_role_token(C.ADMIN)
    f_role = copy.copy(f_role)

    f_role['access'].append('put_new_path')
    f_role[C.LEVEL] += 1
    f_role[C.PAGES].append(
        to_dict(
            UsersPage(
                name='TestPutPage',
                path='/testputpage',
                sub_pages=['test', 'put', 'page'],
            )
        )
    )
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/roles', json=f_role)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_roles_put.__name__,
        (C.LEVEL, f_role[C.LEVEL]),
    )

    # try put role with non exist id
    f_role[C.ID] = TS.NON_EXIST_ID
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/roles', json=f_role)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_roles_put.__name__,
        (C.DETAIL, f'[{f_role[C.NAME]}] [{f_role[C.ID]}] {C.NOT_FOUND}'),
    )


def test_roles_delete(f_role: UsersRole):
    TS.set_role_token(C.ADMIN)

    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/roles', json=f_role)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_roles_delete.__name__,
        (C.NAME, f_role[C.NAME]),
        f_role,
    )

    # try delete again
    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/roles', json=f_role)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_roles_delete.__name__,
        (C.DETAIL, f'[{f_role[C.NAME]}] {C.NOT_FOUND}'),
    )
