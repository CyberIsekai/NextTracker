from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends
from starlette.requests import Request

from core.config import settings
from core.database import get_db

from apps.base.crud import main as base
from apps.base.crud.utils import verify_token
from apps.base.schemas.main import (
    C,
    Config,
    EditTarget,
    LogsResponse,
    Message,
    Error,
    TranslatesWord,
    UsersResponse,
    EditTargetResponse,
    ConfigResponse,
    UsersRole,
    UsersRoleResponse,
    TranslatesResponse,
    Translate,
    LogsSource,
    LogsSourceOnly,
    LogsSourceCache,
)

from apps.tracker.crud import main as tracker
from apps.tracker.schemas.main import (
    Panel,
    ImageGameMaps,
    ImageUpload,
    ImageUploadSubmit,
    ImageData,
)


router = APIRouter(prefix=settings.FASTAPI_API_PATH, tags=[f'{C.BASE} protected'])
router.dependencies = [Depends(verify_token)]


@router.delete('/task_queues/{task_name}', response_model=Message | Error)
def task_queues_delete(task_name: str, db: Session = Depends(get_db)):
    return tracker.task_queues_delete(db, task_name)


@router.get('/users', response_model=UsersResponse)
def users_get(db: Session = Depends(get_db)):
    return base.users_get(db)


@router.put('/users', response_model=EditTargetResponse | Error)
def user_put(body: EditTarget, db: Session = Depends(get_db)):
    return base.user_put(db, body)


@router.delete('/users', response_model=EditTargetResponse | Error)
def user_delete(body: EditTarget, db: Session = Depends(get_db)):
    return base.user_delete(db, body)


@router.get('/panel', response_model=Panel)
def panel_get(db: Session = Depends(get_db)):
    return tracker.panel_get(db)


@router.get('/images', response_model=ImageGameMaps)
def images_get():
    return tracker.images_get()


@router.post('/images', response_model=ImageUpload)
async def images_upload(request: Request):
    return await tracker.images_upload(request)


@router.post('/images/submit', response_model=Message | Error)
async def images_submit(body: ImageUploadSubmit):
    return tracker.images_submit(body)


@router.put('/images', response_model=Message | Error)
async def images_put(body: ImageData):
    return tracker.images_put(body)


@router.delete('/images', response_model=Message | Error)
async def images_delete(body: ImageData):
    return tracker.images_delete(body)


@router.get('/logs', response_model=dict[LogsSource, int])
def logs_tabs_get(db: Session = Depends(get_db)):
    return base.logs_tabs_get(db)


@router.get('/logs/{source}/{page}', response_model=LogsResponse | Error)
def logs_get(source: LogsSource, page: int, db: Session = Depends(get_db)):
    return base.logs_get(db, source, page)


@router.delete('/logs/{source}/{log_id}', response_model=Message | Error)
def log_delete(source: LogsSourceOnly, log_id: int, db: Session = Depends(get_db)):
    return base.log_delete(db, source, log_id)


@router.delete('/logs/{source}', response_model=Message | Error)
def logs_delete(source: LogsSource, db: Session = Depends(get_db)):
    return base.logs_delete(db, source)


@router.get('/logs_cache/{source}/{page}', response_model=LogsResponse | Error)
def logs_cache_get(source: LogsSourceCache, page: int):
    return base.logs_cache_get(source, page)


@router.delete('/logs_cache/{source}', response_model=Message | Error)
def logs_cache_delete(source: LogsSourceCache, db: Session = Depends(get_db)):
    return base.logs_cache_delete(db, source)


@router.get('/configs', response_model=ConfigResponse)
def configs_get(db: Session = Depends(get_db)):
    return base.configs_get(db)


@router.post('/configs', response_model=Config | Error)
def configs_post(body: Config, db: Session = Depends(get_db)):
    return base.configs_post(db, body)


@router.put('/configs', response_model=Config | Error)
def configs_put(body: Config, db: Session = Depends(get_db)):
    return base.configs_put(db, body)


@router.delete('/configs', response_model=Config | Error)
def configs_delete(body: Config, db: Session = Depends(get_db)):
    return base.configs_delete(db, body)


@router.get('/roles', response_model=UsersRoleResponse)
def roles_get(db: Session = Depends(get_db)):
    return base.roles_get(db)


@router.post('/roles', response_model=UsersRole | Error)
def roles_post(body: UsersRole, db: Session = Depends(get_db)):
    return base.roles_post(db, body)


@router.put('/roles', response_model=UsersRole | Error)
def roles_put(body: UsersRole, db: Session = Depends(get_db)):
    return base.roles_put(db, body)


@router.delete('/roles', response_model=UsersRole | Error)
def roles_delete(body: UsersRole, db: Session = Depends(get_db)):
    return base.roles_delete(db, body)


@router.get('/translate/{translate_type}', response_model=TranslatesResponse | Error)
def translate_get(translate_type: Translate, db: Session = Depends(get_db)):
    return base.translate_get(db, translate_type)


@router.post('/translate/{translate_type}', response_model=TranslatesWord | Error)
def translate_post(
    translate_type: Translate, body: TranslatesWord, db: Session = Depends(get_db)
):
    return base.translate_post(db, translate_type, body)


@router.put('/translate/{translate_type}', response_model=TranslatesWord | Error)
def translate_put(
    translate_type: Translate, body: TranslatesWord, db: Session = Depends(get_db)
):
    return base.translate_put(db, translate_type, body)


@router.delete('/translate/{translate_type}', response_model=TranslatesWord | Error)
def translate_delete(
    translate_type: Translate, body: TranslatesWord, db: Session = Depends(get_db)
):
    return base.translate_delete(db, translate_type, body)
