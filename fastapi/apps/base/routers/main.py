from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends
from starlette.requests import Request

from core.config import settings
from core.database import get_db

from apps.base.crud import main as base
from apps.base.schemas.main import (
    C,
    Error,
    Status,
    UserProfile,
    UserRegister,
    UserAuthorize,
    EditTarget,
    EditTargetResponse,
    TranslatesStore,
)


router = APIRouter(prefix=settings.FASTAPI_API_PATH, tags=[C.BASE])


@router.get('/test/{target}')
def test(target: str, request: Request, db: Session = Depends(get_db)):
    return base.test(db, target, request)


@router.post('/register', response_model=UserProfile | Error)
def user_register(body: UserRegister, request: Request, db: Session = Depends(get_db)):
    return base.user_register(db, body, request)


@router.post('/login', response_model=UserProfile | Error)
def user_login(body: UserAuthorize, request: Request):
    return base.user_login(body, request)


@router.put('/user_settings', response_model=EditTargetResponse | Error)
def user_settings(body: EditTarget, request: Request, db: Session = Depends(get_db)):
    return base.user_settings(db, body, request)


@router.get('/check_alive')
def check_alive(db: Session = Depends(get_db)):
    return base.check_alive(db)


@router.get('/translate_store', response_model=TranslatesStore)
def translate_store_get(db: Session = Depends(get_db)):
    return base.translate_store_get(db)


@router.get('/translate_version_check/{user_version}', response_model=Status)
def translate_version_check(user_version: str, db: Session = Depends(get_db)):
    return base.translate_version_check(db, user_version)
