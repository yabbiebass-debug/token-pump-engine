from typing import Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from services import mining
from services.auth import get_current_director

router = APIRouter(prefix='/mining', tags=['mining'])


class EstimateRequest(BaseModel):
    hashrates: Dict[str, float] = Field(default_factory=dict)


@router.get('/status')
async def status():
    return await mining.status()


@router.post('/estimate')
async def estimate(body: EstimateRequest):
    return await mining.profitability({k: v for k, v in body.hashrates.items() if k in mining.ALGOS and v >= 0})


@router.post('/sync')
async def sync(user: dict = Depends(get_current_director)):
    processed = await mining.sync()
    return {'processed': len(processed), 'items': processed}
