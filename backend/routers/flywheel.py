from fastapi import APIRouter, HTTPException, Query
from db import db
from models import FlywheelConfigUpdate
from services import flywheel
from services.events import add_event

router = APIRouter(prefix='/flywheel', tags=['flywheel'])


@router.get('/status')
async def get_status():
    return await flywheel.status()


@router.get('/config')
async def get_config():
    return await flywheel.get_config()


@router.put('/config')
async def put_config(body: FlywheelConfigUpdate):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, 'no fields to update')
    cfg = await flywheel.update_config(patch)
    await add_event('DIRECTOR', f"FLYWHEEL CONFIG updated: {', '.join(f'{k}={v}' for k, v in patch.items())}.")
    return cfg


@router.get('/ledger')
async def get_ledger(limit: int = Query(100, ge=1, le=500), type: str = Query(None)):
    q = {'type': type} if type else {}
    return await db.flywheel_ledger.find(q, {'_id': 0}).sort('created_at', -1).to_list(limit)


@router.get('/history')
async def get_history(hours: int = Query(24, ge=1, le=48)):
    from datetime import timedelta
    from services.util import utcnow, iso
    since = iso(utcnow() - timedelta(hours=hours))
    snaps = await db.token_snapshots.find({'t': {'$gte': since}}, {'_id': 0}).sort('t', 1).to_list(3000)
    injections = await db.flywheel_ledger.find({'type': 'injection'}, {'_id': 0}).sort('created_at', 1).to_list(1000)
    cum, series = 0.0, []
    for i in injections:
        cum += i['amount_sol']
        series.append({'t': i['created_at'], 'amount_sol': i['amount_sol'], 'cumulative_sol': cum, 'tokens': i['tokens_acquired'], 'trigger': i['trigger']})
    return {'snapshots': snaps, 'injections': series}


@router.post('/fast-forward')
async def fast_forward():
    return await flywheel.fast_forward_hour()


@router.post('/inject')
async def inject_now():
    return await flywheel.try_inject('manual')


@router.post('/convert')
async def convert_now():
    from services.util import utcnow
    cfg, st = await flywheel.get_config(), await flywheel.get_state()
    now = utcnow()
    flywheel.accrue(st, cfg, now)
    conv = await flywheel.convert_mined(st, cfg, now, 'manual')
    await flywheel.save_state(st)
    return {'conversion': conv, 'injection': await flywheel.try_inject('manual_conversion')}
