from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, WebSocket

from core.config import settings
from core.database import get_db

from apps.base.schemas.main import C, Message

from apps.tracker.crud import main as tracker
from apps.tracker.schemas.main import (
    Error,
    MatchesResponse,
    Router,
    MatchBody,
    MatchData,
    PlayerAdd,
    PlayerSearch,
    SearchResp,
    MatchStatsPlayer,
    GameMode,
)

router = APIRouter(prefix=settings.FASTAPI_API_PATH, tags=[C.TRACKER])


@router.get('/tracker_test/{target}')
def test(target: str, db: Session = Depends(get_db)):
    return tracker.test(db, target)


@router.post('/matches_router', response_model=MatchesResponse)
def matches_router(body: Router, db: Session = Depends(get_db)):
    return tracker.matches_router(db, body)


@router.get('/match/{matchID}/{game_mode}', response_model=MatchData | Error)
def match_get(matchID: str, game_mode: GameMode, db: Session = Depends(get_db)):
    return tracker.match_get(db, matchID, game_mode)


@router.post('/match_stats', response_model=MatchStatsPlayer | Error)
def match_stats_get(body: MatchBody, db: Session = Depends(get_db)):
    return tracker.match_stats_get(db, body)


@router.post('/player_add', response_model=Message | Error)
def player_add(body: PlayerAdd, db: Session = Depends(get_db)):
    return tracker.player_add(db, body)


@router.post('/player_pre_check', response_model=SearchResp)
def player_pre_check(body: PlayerSearch, db: Session = Depends(get_db)):
    return tracker.player_pre_check(db, body)


@router.websocket('/ws/player_search')
def player_search(ws: WebSocket, db: Session = Depends(get_db)):
    return tracker.player_search(db, ws)
