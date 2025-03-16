from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from core.config import settings
from core.database import get_db

from apps.base.crud.utils import verify_token
from apps.base.schemas.main import C, EditTarget, Message, Error

from apps.tracker.crud import main as tracker
from apps.tracker.schemas.main import (
    MatchesStats,
    PlayerMatchesDeleteResponse,
    TargetGameMode,
    ClearFullmatchesDoublesResponse,
    AllPlayers,
    LabelsItem,
    PlayerMatchesHistoryPars,
    EditPlayerResponse,
    ResetResponse,
    ClearFullmatchDoublesBody,
    UpdateRouter,
    UpdateResponse,
    Labels,
    LabelType,
    ResetType,
)


router = APIRouter(prefix=settings.FASTAPI_API_PATH, tags=[f'{C.TRACKER} protected'])
router.dependencies = [Depends(verify_token)]


@router.post('/update_router', response_model=UpdateResponse | Error)
def update_router(body: UpdateRouter):
    return tracker.update_router(body)


@router.get('/players', response_model=AllPlayers | Error)
def players_get(db: Session = Depends(get_db)):
    return tracker.players_get(db)


@router.put('/players', response_model=EditPlayerResponse | Error)
def player_put(body: EditTarget, db: Session = Depends(get_db)):
    return tracker.player_put(db, body)


@router.delete('/players/{uno}', response_model=Message | Error)
def player_delete(uno: str, db: Session = Depends(get_db)):
    return tracker.player_delete(db, uno)


@router.post('/players/add_game_mode', response_model=Message | Error)
def player_add_game_mode(body: TargetGameMode, db: Session = Depends(get_db)):
    return tracker.player_add_game_mode(db, body)


@router.get('/reset/{reset_type}', response_model=ResetResponse | Error)
def reset(reset_type: ResetType, db: Session = Depends(get_db)):
    return tracker.reset(db, reset_type)


@router.post(
    '/clear_fullmatches_doubles', response_model=ClearFullmatchesDoublesResponse | Error
)
def clear_fullmatches_doubles(
    body: ClearFullmatchDoublesBody, db: Session = Depends(get_db)
):
    return tracker.clear_fullmatches_doubles(db, body)


@router.get(
    '/player_matches_history_pars/{uno}',
    response_model=PlayerMatchesHistoryPars | Error,
)
def player_matches_history_pars(uno: str):
    return tracker.player_matches_history_pars(uno)


@router.post('/player_clear_match_doubles', response_model=Message)
def player_clear_match_doubles(body: TargetGameMode, db: Session = Depends(get_db)):
    return tracker.player_clear_match_doubles(db, body.target, body.game_mode)


@router.post('/player_matches_stats_update', response_model=MatchesStats | Error)
def player_matches_stats_update(body: TargetGameMode, db: Session = Depends(get_db)):
    return tracker.player_matches_stats_update(db, body.target, body.game_mode)


@router.post('/player_matches_delete', response_model=PlayerMatchesDeleteResponse)
def player_matches_delete(body: TargetGameMode, db: Session = Depends(get_db)):
    return tracker.player_matches_delete(db, body.target, body.game_mode)


@router.get('/labels', response_model=dict[LabelType, int])
def labels_count_get(db: Session = Depends(get_db)):
    return tracker.labels_count_get(db)


@router.get('/labels/{label_type}', response_model=Labels | Error)
def labels_get(label_type: LabelType, db: Session = Depends(get_db)):
    return tracker.labels_get(db, label_type)


@router.put('/labels/{label_type}', response_model=LabelsItem | Error)
def labels_put(body: LabelsItem, label_type: LabelType, db: Session = Depends(get_db)):
    return tracker.labels_put(db, body, label_type)


@router.post('/labels/{label_type}', response_model=LabelsItem | Error)
def labels_post(body: LabelsItem, label_type: LabelType, db: Session = Depends(get_db)):
    return tracker.labels_post(db, body, label_type)


@router.delete('/labels/{label_type}/{name}', response_model=LabelsItem | Error)
def labels_delete(name: str, label_type: LabelType, db: Session = Depends(get_db)):
    return tracker.labels_delete(db, name, label_type)


@router.delete('/labels/{label_type}', response_model=Message | Error)
def labels_delete_all(label_type: LabelType, db: Session = Depends(get_db)):
    return tracker.labels_delete_all(db, label_type)
