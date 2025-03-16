from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from core.config import settings
from core.database import get_db

from apps.notes.crud import main as base

from apps.base.crud.utils import verify_token
from apps.base.schemas.main import C, Error

from apps.notes.schemas.main import NoteResponse, NoteData, NoteType


router = APIRouter(prefix=settings.FASTAPI_API_PATH, tags=[C.NOTES])
router.dependencies = [Depends(verify_token)]


@router.get('/notes/{note_type}', response_model=NoteResponse | Error)
def notes_get(note_type: NoteType, db: Session = Depends(get_db)):
    return base.notes_get(db, note_type)


@router.post('/notes', response_model=NoteData)
def notes_post(body: NoteData, db: Session = Depends(get_db)):
    return base.notes_post(db, body)


@router.put('/notes', response_model=NoteData | Error)
def notes_put(body: NoteData, db: Session = Depends(get_db)):
    return base.notes_put(db, body)


@router.delete('/notes', response_model=NoteData | Error)
def notes_delete(body: NoteData, db: Session = Depends(get_db)):
    return base.notes_delete(db, body)
