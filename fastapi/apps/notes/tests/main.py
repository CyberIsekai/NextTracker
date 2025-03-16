# pylint: disable=redefined-outer-name

import pytest

from fastapi import status

from core.database import get_db

from apps.base.tests.store import TS
from apps.base.schemas.main import C, M
from apps.base.crud.utils import now, date_format, to_dict

from apps.notes.schemas.main import NoteData, NoteResponse, NoteType
from apps.notes.crud.main import notes_delete, notes_post


@pytest.fixture(scope='session')
def f_note():
    '''fixture: Test note'''

    note = NoteData(
        id=TS.NON_EXIST_ID,
        name=f'new test {C.NOTE}',
        data={
            C.MESSAGE: f'test {C.NOTE}',
            C.EPOCH: now(C.EPOCH),
            'complete_epoch': 0,
        },
        completed=False,
        time=now(C.ISO),
    )

    # delete and recreate sample note
    with next(get_db()) as db:
        notes_delete(db, note)
        note = notes_post(db, note)

    note[C.TIME] = date_format(note[C.TIME], C.ISO)

    return note


@pytest.fixture(scope='session')
def f_notes_post():
    '''fixture: Test post note'''
    note = NoteData(
        id=-1,
        name=f'test post {C.NOTE}',
        data={C.MESSAGE: '', C.EPOCH: now(C.EPOCH), 'complete_epoch': 0},
        completed=False,
        time='',
    )

    yield note

    with next(get_db()) as db:
        note = notes_delete(db, note)


def test_notes_get():
    TS.set_role_token(C.USER)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/notes/{C.ALL}')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_notes_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    # set admin token for notes path
    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/notes/{TS.NON_EXIST_NAME}')
    TS.check_response(
        resp, status.HTTP_422_UNPROCESSABLE_ENTITY, test_notes_get.__name__
    )

    for note_type in NoteType.__args__:
        resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/notes/{note_type}')
        TS.check_response(resp, status.HTTP_200_OK, test_notes_get.__name__)
        result: NoteResponse = resp.json()
        assert isinstance(result.get(C.NOTES), list)


def test_notes_post(f_notes_post: NoteData):
    TS.set_role_token(C.ADMIN)

    note = to_dict(f_notes_post)
    note[C.DATA] = to_dict(note[C.DATA])

    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/notes', json=note)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_notes_post.__name__,
        (C.NAME, note[C.NAME]),
    )
    res: NoteData = resp.json()
    assert res[C.NAME] == note[C.NAME]

    # post again
    resp = TS.client.post(f'{TS.FASTAPI_API_PATH}/notes', json=note)
    TS.check_response(
        resp,
        status.HTTP_302_FOUND,
        test_notes_post.__name__,
        (C.DETAIL, f'[{note[C.NAME]}] {C.ALREADY_EXIST}'),
    )


def test_notes_put(f_note):
    TS.set_role_token(C.ADMIN)

    f_note[C.NAME] = ''
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/notes', json=f_note)
    TS.check_response(
        resp,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        test_notes_put.__name__,
        (C.DETAIL, f'{C.NOTE} {C.NAME} [{f_note[C.NAME]}] {C.NOT_VALID}'),
        f_note,
    )

    f_note[C.NAME] = f'test change {C.NAME}'
    f_note[C.DATA][C.MESSAGE] = f'test change {C.MESSAGE}'
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/notes', json=f_note)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_notes_put.__name__,
        (C.NAME, f_note[C.NAME]),
        f_note,
    )
    f_note[C.NAME] = f_note[C.NAME]

    f_note[C.ID] = TS.NON_EXIST_ID
    resp = TS.client.put(f'{TS.FASTAPI_API_PATH}/notes', json=f_note)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_notes_put.__name__,
        (C.DETAIL, f'[{f_note[C.ID]}] {C.NOT_FOUND}'),
    )


def test_notes_delete(f_note):
    TS.set_role_token(C.ADMIN)

    # exist test note
    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/notes', json=f_note)
    TS.check_response(
        resp,
        status.HTTP_200_OK,
        test_notes_delete.__name__,
        (C.NAME, f_note[C.NAME]),
        f_note,
    )

    # non exist
    resp = TS.client.request(M.DELETE, f'{TS.FASTAPI_API_PATH}/notes', json=f_note)
    TS.check_response(
        resp,
        status.HTTP_404_NOT_FOUND,
        test_notes_delete.__name__,
        (C.DETAIL, f'[{f_note[C.NAME]}] {C.NOT_FOUND}'),
    )
