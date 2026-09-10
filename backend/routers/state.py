from fastapi import APIRouter
from db import db
from constants import AGENTS, STAGES, GATED, PACKAGES, TIERS, SOL_RECIPIENT, TOKEN_MINT
from models import AutoCycleUpdate
from services.events import get_app_state, add_event

router = APIRouter(tags=['state'])


@router.get('/state')
async def get_state():
    app = await get_app_state()
    return {
        'state': app,
        'leads': await db.leads.find({}, {'_id': 0}).sort('created_at', -1).to_list(500),
        'clients': await db.clients.find({}, {'_id': 0}).sort('created_at', -1).to_list(500),
        'approvals': await db.approvals.find({}, {'_id': 0}).sort('created_at', -1).to_list(500),
        'events': await db.events.find({}, {'_id': 0}).sort('created_at', -1).to_list(250),
        'payments': await db.payments.find({}, {'_id': 0}).sort('created_at', -1).to_list(500),
        'withdrawals': await db.withdrawals.find({}, {'_id': 0}).sort('created_at', -1).to_list(500),
    }


@router.get('/meta')
async def get_meta():
    return {'agents': AGENTS, 'stages': STAGES, 'gated': sorted(GATED), 'packages': PACKAGES, 'tiers': TIERS,
            'sol_recipient': SOL_RECIPIENT, 'token_mint': TOKEN_MINT}


@router.patch('/state/auto-cycle')
async def set_auto_cycle(body: AutoCycleUpdate):
    await db.app_state.update_one({'key': 'state'}, {'$set': {'auto_cycle': body.auto_cycle}}, upsert=True)
    await add_event('DIRECTOR', f"Auto-cycle {'ENABLED (server-side, 60s interval)' if body.auto_cycle else 'DISABLED'} by Director.")
    return await get_app_state()
