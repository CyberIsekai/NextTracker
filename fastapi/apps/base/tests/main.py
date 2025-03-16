from fastapi import status

from apps.base.tests.store import TS
from apps.base.schemas.main import C


def test_panel_get():
    TS.set_role_token(C.GUEST)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/panel')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_panel_get.__name__,
        (C.DETAIL, f'{C.GUEST} {C.TOKEN}'),
    )

    TS.set_role_token(C.USER)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/panel')
    TS.check_response(
        resp,
        status.HTTP_401_UNAUTHORIZED,
        test_panel_get.__name__,
        (C.DETAIL, f'{C.ROLES} {C.USER} not allowed'),
    )

    TS.set_role_token(C.ADMIN)
    resp = TS.client.get(f'{TS.FASTAPI_API_PATH}/panel')
    TS.check_response(resp, status.HTTP_200_OK, test_panel_get.__name__)
