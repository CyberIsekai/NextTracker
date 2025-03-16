# pylint: disable=redefined-outer-name

import copy
import pytest

from fastapi import status

from core.database import get_db

from apps.base.tests.store import TS
from apps.base.crud.store_tables import SBT
from apps.base.crud.main import translate_post
from apps.base.schemas.main import C, M, Translate, TranslatesWord


@pytest.fixture(scope='session')
def f_word() -> TranslatesWord:
    '''fixture: Test word'''

    word = TranslatesWord(
        id=-1, name='_test_word_', en='Test word', ru='Тестовое слово'
    )
    # delete and recreate test word
    with next(get_db()) as db:
        for translate_type in Translate.__args__:
            table = SBT.__dict__[translate_type]
            db.query(table).filter(table.name.in_(('_test_word_', '_test_'))).delete()

        translate_type = Translate.__args__[0]
        word = translate_post(db, translate_type, word)

    return word


def test_translate_store_get():
    TS.set_role_token(C.GUEST)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/translate_store')
    TS.check_response(resp, status.HTTP_200_OK, test_translate_get.__name__)


def test_translate_get():
    TS.set_role_token(C.USER)

    translate_type = Translate.__args__[0]
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/translate/{translate_type}')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_translate_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)
    for translate_type in Translate.__args__:
        resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/translate/{translate_type}')
        TS.check_response(resp, status.HTTP_200_OK, test_translate_get.__name__)


def test_translate_post(f_word: TranslatesWord):
    TS.set_role_token(C.ADMIN)
    translate_type = Translate.__args__[1]
    resp = TS.client.post(
        f'{TS.FASTAPI_API_PATH}/translate/{translate_type}', json=f_word
    )
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_translate_post.__name__,
        (C.NAME, f_word[C.NAME]),
    )

    # post again
    resp = TS.client.post(
        f'{TS.FASTAPI_API_PATH}/translate/{translate_type}', json=f_word
    )
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_translate_post.__name__,
        (C.DETAIL, f'[{translate_type}] [{f_word[C.NAME]}] {C.ALREADY_EXIST}'),
    )


def test_translate_put(f_word: TranslatesWord):
    TS.set_role_token(C.ADMIN)

    translate_type = Translate.__args__[0]
    body = copy.copy(f_word)
    body[C.NAME] = '_test_'
    body[C.EN] = 'test'
    body[C.RU] = 'тест'

    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/translate/{translate_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_translate_put.__name__,
        (C.NAME, body[C.NAME]),
    )

    # try put word with non exist id and non exist name
    body[C.ID] = -1
    body[C.NAME] = TS.NON_EXIST_NAME
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/translate/{translate_type}', json=body)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_translate_put.__name__,
        (C.DETAIL, f'[{translate_type}] [{body[C.NAME].lower()}] {C.NOT_FOUND}'),
    )


def test_translate_delete(f_word: TranslatesWord):
    TS.set_role_token(C.ADMIN)
    translate_type = Translate.__args__[0]
    resp = TS.client.request(
        M.DELETE, f'{TS.FASTAPI_API_PATH}/translate/{translate_type}', json=f_word
    )
    TS.check_response(resp, status.HTTP_200_OK, test_translate_delete.__name__)

    # try delete again
    resp = TS.client.request(
        M.DELETE, f'{TS.FASTAPI_API_PATH}/translate/{translate_type}', json=f_word
    )
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_translate_delete.__name__,
        (C.DETAIL, f'[{translate_type}] [{f_word[C.ID]}] {C.NOT_FOUND}'),
    )
