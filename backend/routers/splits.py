from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from services import splitter
from services.auth import get_current_director

router = APIRouter(prefix='/splits', tags=['splits'])


class SplitRequest(BaseModel):
    total_sol: float = Field(gt=0, le=100000)
    main_wallet: str = Field(min_length=32, max_length=48)
    trigger: str = 'manual'
    tx_signature: Optional[str] = None


class PolicyRequest(BaseModel):
    main_pct: Optional[float] = Field(default=None, ge=0, le=1)
    rebuy_pct: Optional[float] = Field(default=None, ge=0, le=1)
    buffer_pct: Optional[float] = Field(default=None, ge=0, le=1)


@router.get('/policy')
async def policy():
    return await splitter.get_policy()


@router.put('/policy')
async def set_policy(body: PolicyRequest, user: dict = Depends(get_current_director)):
    _ = user
    try:
        return await splitter.set_policy({k: v for k, v in body.model_dump().items() if v is not None})
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post('')
async def split(body: SplitRequest, user: dict = Depends(get_current_director)):
    _ = user
    try:
        return await splitter.split_profit(body.total_sol, body.main_wallet.strip(), body.trigger, body.tx_signature)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get('/history')
async def history():
    return await splitter.history()
