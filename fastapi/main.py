import traceback
from contextlib import asynccontextmanager
import uvicorn

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from core.config import settings

from apps.base.schemas.main import C
from apps.base.crud.utils import in_logs_request, json_error, manage_monitor, to_dict
from apps.base.routers.main import router as RouterBase
from apps.base.routers.protected import router as RouterBaseProtected

from apps.notes.routers.main import router as RouterNotes

from apps.tracker.routers.main import router as RouterTracker
from apps.tracker.routers.protected import router as RouterTrackerProtected


@asynccontextmanager
async def lifespan(lifespan_app: FastAPI):
    if manage_monitor(C.STATUS) is False:
        manage_monitor('start')

    # there app is running
    yield

    settings.LOGGING.warning('worker shutdown')


app = FastAPI(lifespan=lifespan)
app.include_router(RouterBase)
app.include_router(RouterBaseProtected)
app.include_router(RouterNotes)
app.include_router(RouterTracker)
app.include_router(RouterTrackerProtected)
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        [f'http://{static_ip}' for static_ip in settings.STATIC_IPS]
        + [f'https://{static_ip}' for static_ip in settings.STATIC_IPS]
    ),
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.middleware('http')
async def request_middleware(request: Request, call_next):
    body = await request.body()
    request.state.body = to_dict(body.decode()) if body else None

    try:
        res = await call_next(request)
    except Exception as e:
        res = json_error(status.HTTP_500_INTERNAL_SERVER_ERROR, 'Unexpected answer')
        trace = traceback.format_exc()
        settings.LOGGING.error(trace)
        source = 'logs_request_error'
        data = {C.DETAIL: type(e).__name__, 'trace': trace}
    else:
        source = 'logs_request'
        data = {}

    in_logs_request(request, source, data)

    return res


if __name__ == '__main__':
    uvicorn.run(
        app,
        host=settings.FASTAPI_HOST,
        port=settings.FASTAPI_PORT,
        workers=settings.GUNICORN_WORKERS,
        log_level='debug',
    )
