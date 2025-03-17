# pylint: disable=redefined-outer-name

import pytest

from fastapi import status

from core.config import settings
from core.database import get_db

from apps.base.tests.store import TS
from apps.base.crud.store_tables import SBT
from apps.base.crud.main import user_delete
from apps.base.crud.utils import date_format, get_last_id, redis_manage, now
from apps.base.schemas.main import (
    C,
    M,
    SUser,
    UserAuthorize,
    UserProfile,
    UserRegister,
    UsersResponse,
    EditTarget,
    EditTargetResponse,
)


@pytest.fixture(scope='session')
def f_users():
    '''fixture: Test users'''

    users: list[UserRegister] = [
        {
            C.LOGIN: f'test_{C.USER}',
            C.EMAIL: f'test@{C.EMAIL}.com',
            C.PASSWORD: f'test_{C.PASSWORD}_{TS.NON_EXIST_ID}',
            C.USERNAME: f'test{C.USERNAME}',
            C.LANGUAGE: settings.LANGUAGES[0],
            C.DATA: {},
        },
        {
            C.LOGIN: f'test_{C.USER}_2',
            C.EMAIL: None,
            C.PASSWORD: f'test_{C.PASSWORD}_^#?',
            C.USERNAME: None,
            C.LANGUAGE: settings.LANGUAGES[1],
            C.DATA: {},
        },
        {
            C.LOGIN: settings.ADMIN_LOGIN,
            C.EMAIL: None,
            C.PASSWORD: settings.ADMIN_PASSWORD,
            C.USERNAME: None,
            C.LANGUAGE: settings.LANGUAGES[0],
            C.DATA: {},
        },
    ]

    with next(get_db()) as db:
        user_delete(db, EditTarget(target=users[0][C.LOGIN], name=C.LOGIN, value=None))
        user_delete(db, EditTarget(target=users[1][C.LOGIN], name=C.LOGIN, value=None))

    # register new user and set user token
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/register', json=users[0])
    result: UserProfile = resp.json()
    TS.ROLE_TOKENS[C.USER] = result[C.TOKEN]

    # set admin token for protected routes
    body: UserAuthorize = {C.LOGIN: users[2][C.LOGIN], C.PASSWORD: users[2][C.PASSWORD]}
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/login', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        f_users.__name__,
        (C.LOGIN, body[C.LOGIN]),
        body,
    )
    result: UserProfile = resp.json()
    TS.ROLE_TOKENS[C.ADMIN] = result[C.TOKEN]

    return users


def test_user_register(f_users: list[UserRegister]):
    # exist USER
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/register', json=f_users[0])
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_user_register.__name__,
        (C.DETAIL, f'{C.USER} [{f_users[0][C.LOGIN]}] {C.ALREADY_EXIST}'),
        f_users[0],
    )

    # new USER_2
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/register', json=f_users[1])
    TS.check_response(
        resp, status.HTTP_200_OK, test_user_register.__name__, None, f_users[1]
    )
    result: UserProfile = resp.json()
    assert result.get(C.TOKEN) is not None


def test_user_login(f_users: list[UserRegister]):
    body: UserAuthorize = {C.LOGIN: TS.NON_EXIST_NAME, C.PASSWORD: TS.NON_EXIST_NAME}
    # non exist user login
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/login', json=body)
    TS.check_response(
        resp,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        test_user_login.__name__,
        (C.DETAIL, f'{C.LOGIN} or {C.PASSWORD} incorrect'),
    )

    # login as user
    body[C.LOGIN] = f_users[0][C.LOGIN]
    body[C.PASSWORD] = f_users[0][C.PASSWORD]
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/login', json=body)
    TS.check_response(
        resp, status.HTTP_200_OK, test_user_login.__name__, (C.ROLES, [C.USER])
    )

    # login as admin
    body[C.LOGIN] = f_users[2][C.LOGIN]
    body[C.PASSWORD] = f_users[2][C.PASSWORD]
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/login', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_user_login.__name__,
        (C.ROLES, [C.USER, C.ADMIN]),
    )  # UserProfile


def put_user(body: EditTarget, res_status: int, message: str):
    # UserProfile
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/user_settings', json=body)
    TS.check_response(
        resp,
        res_status,
        put_user.__name__,
        (C.MESSAGE if res_status == status.HTTP_200_OK else C.DETAIL, message),
        body,
    )


def test_user_settings():
    body = {C.TARGET: TS.NON_EXIST_NAME, C.NAME: '', C.VALUE: ''}

    TS.set_role_token(C.GUEST)
    put_user(body, status.HTTP_401_UNAUTHORIZED, f'{C.GUEST} {C.TOKEN}')

    TS.set_role_token(C.USER)

    body[C.NAME] = TS.NON_EXIST_NAME
    put_user(body, status.HTTP_405_METHOD_NOT_ALLOWED, f'{body[C.NAME]} not allowed')

    body[C.NAME] = C.EMAIL
    body[C.VALUE] = 'not_valid_mail.com'
    put_user(
        body,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        f'{body[C.NAME]} {body[C.VALUE]} {C.NOT_VALID}',
    )
    body[C.VALUE] = 'valid@mail.com'
    put_user(body, status.HTTP_200_OK, f'{body[C.NAME]} changed to {body[C.VALUE]}')
    # test error if change to same EMAIL
    put_user(
        body,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        f'{body[C.NAME]} {body[C.VALUE]} same {C.VALUE} not changed',
    )

    # USERNAME less than 4 characters
    body[C.NAME] = C.USERNAME
    body[C.VALUE] = 'sh'
    put_user(
        body,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        f'{body[C.NAME]} {body[C.VALUE]} too short',
    )
    # USERNAME more than 30 characters
    body[C.VALUE] *= 18
    put_user(
        body,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        f'{body[C.NAME]} {body[C.VALUE]} too long',
    )
    body[C.VALUE] = 'valid_username'
    put_user(body, status.HTTP_200_OK, f'{body[C.NAME]} changed to {body[C.VALUE]}')

    # non exist LANGUAGE
    body[C.NAME] = C.LANGUAGE
    body[C.VALUE] = TS.NON_EXIST_NAME
    put_user(
        body,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        f'{body[C.NAME]} {body[C.VALUE]} {C.NOT_VALID}',
    )
    # exist LANGUAGE
    body[C.VALUE] = settings.LANGUAGES[1]
    put_user(body, status.HTTP_200_OK, f'{body[C.NAME]} changed to {body[C.VALUE]}')


def test_users_get():
    # check access for 'users' path
    TS.set_role_token(C.USER)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/users')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_users_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    # set admin token for protected routes
    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/users')
    TS.check_response(resp, status.HTTP_200_OK, test_users_get.__name__)
    result: UsersResponse = resp.json()
    users: list[UserProfile] | None = result.get(C.USERS)
    assert users is not None and len(users) > 0


def test_user_put(f_users: list[UserRegister]):
    body: EditTarget = {C.TARGET: TS.NON_EXIST_NAME, C.NAME: C.ID, C.VALUE: ''}
    # user_put for columns (USERNAME, EMAIL, LANGUAGE)
    # already tested in test_user_settings

    # set non exist user
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_user_put.__name__,
        (C.DETAIL, f'{C.USER} [{TS.NON_EXIST_NAME}] {C.NOT_FOUND}'),
    )

    # set exist user login
    body[C.TARGET] = f_users[0][C.LOGIN]

    # non exist column
    body[C.NAME] = TS.NON_EXIST_NAME
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        test_user_put.__name__,
        (C.DETAIL, f'{body[C.NAME]} not allowed'),
    )

    # try change id to already used id
    body[C.NAME] = C.ID
    body[C.VALUE] = redis_manage(f'{C.USER}:{f_users[2][C.LOGIN]}', 'hget', C.ID)
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_user_put.__name__,
        (C.DETAIL, f'used by {f_users[2][C.LOGIN]}'),
    )
    # check valid  used user id
    with next(get_db()) as db:
        body[C.VALUE] = get_last_id(db, SBT.users) + 1
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_user_put.__name__,
        (C.MESSAGE, f'{body[C.NAME]} changed to {body[C.VALUE]}'),
    )
    result: EditTargetResponse = resp.json()

    body[C.NAME] = C.STATUS
    # check if STATUS not number
    body[C.VALUE] = TS.NON_EXIST_NAME
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        test_user_put.__name__,
        (C.DETAIL, f'{body[C.NAME]} {body[C.VALUE]} {C.NOT_VALID}'),
        body,
    )
    # check valid STATUS
    body[C.VALUE] = SUser.ENABLED
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_user_put.__name__,
        (C.MESSAGE, f'{body[C.NAME]} changed to {body[C.VALUE]}'),
        body,
    )

    # check add not exist role
    body[C.NAME] = C.ROLES
    body[C.VALUE] = [C.USER, TS.NON_EXIST_NAME]
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        test_user_put.__name__,
        (C.DETAIL, f'{body[C.NAME]} {body[C.VALUE]} {C.NOT_VALID}'),
    )
    # valid roles
    body[C.VALUE] = [C.USER, C.ADMIN]
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_user_put.__name__,
        (C.MESSAGE, f'{body[C.NAME]} changed to {body[C.VALUE]}'),
    )
    # set back to user roles
    body[C.VALUE] = [C.USER]
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_user_put.__name__,
        (C.MESSAGE, f'{body[C.NAME]} changed to {body[C.VALUE]}'),
    )

    body[C.NAME] = C.TIME
    # NOT_VALID TIME
    body[C.VALUE] = TS.NON_EXIST_NAME
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_405_METHOD_NOT_ALLOWED,
        test_user_put.__name__,
        (C.DETAIL, f'{body[C.NAME]} {body[C.VALUE]} {C.NOT_VALID}'),
    )
    # valid TIME
    body[C.VALUE] = now(C.EPOCH)
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(resp, status.HTTP_200_OK, test_user_put.__name__)
    result: EditTargetResponse = resp.json()
    formated_data = date_format(body[C.VALUE], C.DATETIME)
    assert result.get(C.MESSAGE) == f'{body[C.NAME]} changed to {formated_data}'


def test_user_delete(f_users: list[UserRegister]):
    TS.set_role_token(C.ADMIN)

    body: EditTarget = {C.TARGET: '-1', C.NAME: C.ID, C.VALUE: ''}
    # UserProfile
    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_user_delete.__name__,
        (C.DETAIL, f'{C.USER} {C.ID} [{body[C.TARGET]}] {C.NOT_FOUND}'),
    )

    body[C.TARGET] = f_users[0][C.LOGIN]
    body[C.NAME] = C.LOGIN
    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/users', json=body)
    TS.check_response(
        resp, status.HTTP_200_OK, test_user_delete.__name__, (C.MESSAGE, C.DELETED)
    )
