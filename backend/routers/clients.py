from fastapi import APIRouter, Depends, HTTPException
from db import db
from models import ClientUpdate
from services.auth import get_current_director
from services.events import add_event

router = APIRouter(tags=['clients'])


@router.get('/clients')
async def list_clients():
    return await db.clients.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)


@router.patch('/clients/{client_id}')
async def update_client(client_id: str, body: ClientUpdate, user: dict = Depends(get_current_director)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, 'no fields to update')
    if patch.get('build_pct') == 100 and 'status' not in patch:
        patch['status'] = 'LIVE'
    res = await db.clients.find_one_and_update({'id': client_id}, {'$set': patch}, projection={'_id': 0}, return_document=True)
    if not res:
        raise HTTPException(404, 'client not found')
    await add_event('BUILDER', f"{res['biz']} ({res['package']}) updated by Director: " + ', '.join(f'{k}={v}' for k, v in patch.items()) + '.')
    return res
