from fastapi import APIRouter, HTTPException
from db import db
from services.events import add_event

router = APIRouter(tags=['approvals'])


async def _decide(approval_id: str, status: str):
    res = await db.approvals.find_one_and_update({'id': approval_id, 'status': 'pending'}, {'$set': {'status': status}},
                                                 projection={'_id': 0}, return_document=True)
    if not res:
        raise HTTPException(404, 'pending approval not found')
    if status == 'approved':
        await add_event(res['agent'], f"DIRECTOR APPROVED: \"{res['title']}\". Dispatched payload downstream.", 'gate')
    else:
        await add_event(res['agent'], f"DIRECTOR REJECTED: \"{res['title']}\". Returned to agent for refinement.")
    return res


@router.post('/approvals/{approval_id}/approve')
async def approve(approval_id: str):
    return await _decide(approval_id, 'approved')


@router.post('/approvals/{approval_id}/reject')
async def reject(approval_id: str):
    return await _decide(approval_id, 'rejected')
