import datetime
from typing import Literal

from fastapi import HTTPException, status
from pydantic import BaseModel, field_validator

from apps.base.schemas.main import C

NoteType = Literal['completed', 'uncompleted', 'all']


class Note(BaseModel):
    message: str
    epoch: int
    complete_epoch: int


class NoteData(BaseModel):
    id: int
    name: str
    data: Note
    completed: bool
    time: str | datetime.datetime

    @field_validator(C.NAME)
    def validate_login(cls, value: str):
        if not value.strip():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f'{C.NOTE} {C.NAME} [{value}] {C.NOT_VALID}',
            )

        return value


class NoteResponse(BaseModel):
    notes: list[NoteData]
    stats: dict[NoteType, int]
