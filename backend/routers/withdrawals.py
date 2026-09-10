from fastapi import APIRouter, Depends, Query
from db import db
from models import WithdrawalCreate
from services import treasury
from services.auth import get_current_director

router = APIRouter(tags=['treasury'])


@router.get('/vault')
async def get_vault():
    return await treasury.vault_summary()


@router.get('/withdrawals')
async def list_withdrawals():
    return await db.withdrawals.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)


@router.post('/withdrawals', status_code=201)
async def create_withdrawal(body: WithdrawalCreate, user: dict = Depends(get_current_director)):
    return await treasury.record_withdrawal(body.signature, body.memo, user)


@router.get('/treasury/activity')
async def treasury_activity(limit: int = Query(60, ge=1, le=200)):
    await treasury.sync_if_stale(45)
    return {'address': treasury.SOL_RECIPIENT, 'items': await treasury.list_activity(limit)}


@router.post('/treasury/sync')
async def treasury_sync(user: dict = Depends(get_current_director)):
    added = await treasury.sync_activity()
    return {'added': len(added), 'items': added}
