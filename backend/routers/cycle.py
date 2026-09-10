from fastapi import APIRouter, Depends
from services.auth import get_current_director
from services.cycle import run_cycle

router = APIRouter(tags=['cycle'])


@router.post('/cycle/run')
async def post_run_cycle(user: dict = Depends(get_current_director)):
    return await run_cycle('manual')
