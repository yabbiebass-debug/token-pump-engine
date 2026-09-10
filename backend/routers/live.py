from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from models import SIGNATURE_RE
from services import live
from services.auth import get_current_director

router = APIRouter(prefix='/live', tags=['live'])


class BuildRequest(BaseModel):
    intent_id: str
    wallet: str = Field(min_length=32, max_length=48)
    amount_sol: float = Field(gt=0)
    slippage_bps: Optional[int] = Field(default=None, ge=10, le=2000)


class ConfirmRequest(BaseModel):
    intent_id: str
    signature: str = Field(pattern=SIGNATURE_RE)


class DismissRequest(BaseModel):
    intent_id: str


@router.get('/status')
async def status():
    return await live.live_status()


@router.get('/quote')
async def get_quote(amount_sol: float = Query(gt=0, le=100), slippage_bps: int = Query(300, ge=10, le=2000)):
    q = await live.quote(amount_sol, slippage_bps)
    q.pop('raw', None)
    return q


@router.post('/build')
async def build(body: BuildRequest, user: dict = Depends(get_current_director)):
    return await live.build(body.intent_id, body.wallet.strip(), body.amount_sol, body.slippage_bps, user)


@router.post('/confirm')
async def confirm(body: ConfirmRequest, user: dict = Depends(get_current_director)):
    return await live.confirm(body.intent_id, body.signature, user)


@router.post('/dismiss')
async def dismiss(body: DismissRequest, user: dict = Depends(get_current_director)):
    return await live.dismiss(body.intent_id, user)
