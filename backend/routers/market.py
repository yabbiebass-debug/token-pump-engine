from fastapi import APIRouter, HTTPException
from models import VerifySignatureRequest
from services import market

router = APIRouter(tags=['market'])


@router.get('/token/live')
async def token_live():
    try:
        return await market.get_token_live()
    except Exception as e:
        raise HTTPException(503, f'token data unavailable: {e}')


@router.get('/market/sol')
async def sol_price():
    return await market.get_sol_price()


@router.get('/wallet/{address}')
async def wallet(address: str):
    if not (32 <= len(address) <= 48):
        raise HTTPException(400, 'invalid address')
    try:
        return await market.get_wallet(address)
    except Exception as e:
        raise HTTPException(502, f'rpc failed: {e}')


@router.post('/wallet/verify')
async def verify(body: VerifySignatureRequest):
    try:
        return await market.verify_signature(body.signature.strip())
    except Exception as e:
        raise HTTPException(502, f'rpc failed: {e}')
