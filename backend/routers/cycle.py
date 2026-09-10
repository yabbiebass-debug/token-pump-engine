from fastapi import APIRouter
from services.cycle import run_cycle

router = APIRouter(tags=['cycle'])


@router.post('/cycle/run')
async def post_run_cycle():
    return await run_cycle('manual')
