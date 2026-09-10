from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from services import executor, signer
from services.auth import get_current_director

router = APIRouter(prefix='/executor', tags=['executor'])


class BuyRequest(BaseModel):
    amount_sol: float = Field(gt=0, le=100)
    trigger: str = 'manual'


@router.get('/status')
async def status():
    try:
        _, hot = signer.load_keypair()
    except RuntimeError as e:
        hot, err = None, str(e)
    else:
        err = None
    return {'enabled': signer.executor_enabled(), 'hot_wallet': hot, 'config_error': err}


@router.post('/buy')
async def buy(body: BuyRequest, user: dict = Depends(get_current_director)):
    try:
        return await executor.execute_buy(body.amount_sol, body.trigger, signed_by=user['email'])
    except RuntimeError as e:
        raise HTTPException(400, str(e))


@router.post('/drain')
async def drain(trigger: str = 'manual', user: dict = Depends(get_current_director)):
    _ = user
    return await executor.drain_reserve(trigger)
