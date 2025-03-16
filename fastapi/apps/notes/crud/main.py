from sqlalchemy.orm import Session
from fastapi import status

from apps.base.crud.store_tables import SBT
from apps.base.schemas.main import Error

from apps.base.schemas.main import C
from apps.base.crud.utils import get_last_id, to_dict, json_error

from apps.notes.schemas.main import NoteResponse, NoteData, NoteType


def notes_get(db: Session, note_type: NoteType) -> NoteResponse | Error:
    if note_type == C.COMPLETED:
        filter_by = SBT.notes.completed == True
    elif note_type == C.UNCOMPLETED:
        filter_by = SBT.notes.completed == False
    elif note_type == C.ALL:
        filter_by = True
    else:
        return json_error(status.HTTP_404_NOT_FOUND, f'{note_type} {C.NOT_FOUND}')

    notes = db.query(SBT.notes).order_by(SBT.notes.time.desc())
    notes = notes.filter(filter_by).all()
    notes = list(map(to_dict, notes))
    notes.sort(
        key=lambda note: note[C.DATA].get('complete_epoch', 0),
        reverse=note_type == C.COMPLETED,
    )

    return {
        C.NOTES: notes,
        C.STATS: {
            C.ALL: db.query(SBT.notes).count(),
            C.COMPLETED: db.query(SBT.notes)
            .filter(SBT.notes.completed == True)
            .count(),
            C.UNCOMPLETED: db.query(SBT.notes)
            .filter(SBT.notes.completed == False)
            .count(),
        },
    }


def notes_post(db: Session, note: NoteData) -> NoteData:
    table = SBT.notes
    if has := db.query(table).filter(table.name == note.name).first():
        return json_error(status.HTTP_302_FOUND, f'[{has.name}] {C.ALREADY_EXIST}')

    new_note = table(
        id=get_last_id(db, table) + 1,
        name=note.name,
        data=to_dict(note.data),
        completed=note.completed,
    )

    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    return to_dict(new_note)


def notes_put(db: Session, note: NoteData) -> NoteData | Error:
    note_found: NoteData | None = (
        db.query(SBT.notes).filter(SBT.notes.id == note.id).first()
    )
    if note_found is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{note.id}] {C.NOT_FOUND}')

    db.query(SBT.notes).filter(SBT.notes.id == note.id).update(
        {
            SBT.notes.completed: note.completed,
            SBT.notes.name: note.name,
            SBT.notes.data: to_dict(note.data),
        }
    )
    db.commit()

    return note


def notes_delete(db: Session, note: NoteData) -> NoteData | Error:
    note_found = db.query(SBT.notes).filter(SBT.notes.name == note.name).first()

    if note_found is None:
        return json_error(status.HTTP_404_NOT_FOUND, f'[{note.name}] {C.NOT_FOUND}')

    db.delete(note_found)
    db.commit()

    return note
