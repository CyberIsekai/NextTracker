from httpx import Response
from fastapi.testclient import TestClient

from main import app
from core.config import settings

from apps.base.schemas.main import C
from apps.base.crud.utils import in_logs


class TestStore:
    def __init__(self):
        self.client: TestClient = TestClient(app)
        self.client.headers = {'Content-Type': 'application/json', C.TOKEN: C.GUEST}

        self.FASTAPI_API_PATH = settings.FASTAPI_API_PATH

        self.NON_EXIST_ID = 8197117468
        self.NON_EXIST_NAME = 'fQMVCAoEFgACAQI'

        self.ROLE_TOKENS = {C.GUEST: C.GUEST}

    def set_role_token(self, role: str):
        self.client.headers[C.TOKEN] = self.ROLE_TOKENS[role]

    @staticmethod
    def check_response(
        resp: Response,
        expected_code: int | tuple[int],
        name: str,
        expected=None,
        log_data=None,
    ):
        if isinstance(expected_code, int):
            valid = resp.status_code == expected_code
        else:
            valid = resp.status_code in expected_code

        if valid and expected is None:
            return

        result = resp.json()

        if valid and expected is not None:
            key, expected_message = expected
            result_message = result.get(key)
            if result_message == expected_message:
                return

        in_logs(
            f'{TestStore.check_response.__name__} {name}',
            str(resp.url),
            'logs_error',
            {
                'expected_code': expected_code,
                'expected': expected,
                C.RESULT: result,
                'log_data': log_data,
            },
        )

        assert False


TS = TestStore()
