from fastapi import APIRouter, Depends, HTTPException
from db import db
from services.auth import get_current_director
from services.events import add_event

router = APIRouter(tags=['approvals'])


async def _decide(approval_id: str, status: str, user: dict):
    res = await db.approvals.find_one_and_update({'id': approval_id, 'status': 'pending'}, {'$set': {'status': status, 'decided_by': user['email']}},
                                                 projection={'_id': 0}, return_document=True)
    if not res:
        raise HTTPException(404, 'pending approval not found')
    if status == 'approved':
        await add_event(res['agent'], f"DIRECTOR APPROVED: \"{res['title']}\". Dispatched payload downstream.", 'gate')
    else:
        await add_event(res['agent'], f"DIRECTOR REJECTED: \"{res['title']}\". Returned to agent for refinement.")
    return res


@router.post('/approvals/{approval_id}/approve')
async def approve(approval_id: str, user: dict = Depends(get_current_director)):
    return await _decide(approval_id, 'approved', user)


@router.post('/approvals/{approval_id}/reject')
async def reject(approval_id: str, user: dict = Depends(get_current_director)):
    return await _decide(approval_id, 'rejected', user)
