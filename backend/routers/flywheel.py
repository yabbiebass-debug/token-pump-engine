import csv
import io
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from db import db
from models import FlywheelConfigUpdate
from services import flywheel
from services.auth import get_current_director
from services.events import add_event
from services.util import utcnow, iso

router = APIRouter(prefix='/flywheel', tags=['flywheel'])
CSV_COLUMNS = ['created_at', 'type', 'mode', 'amount_sol', 'amount_usd', 'reserve_after', 'tokens_acquired', 'avg_price_sol', 'price_before_sol', 'price_after_sol',
               'impact_pct', 'curve_progress_after_pct', 'trigger', 'tx_signature', 'slot', 'signer_wallet', 'signed_by', 'sol_price_usd', 'reason', 'resumes_at', 'cap_sol',
               'biz', 'package', 'pct', 'payment_id', 'source', 'pool', 'payout_sol', 'id']


@router.get('/status')
async def get_status():
    return await flywheel.status()


@router.get('/config')
async def get_config():
    return await flywheel.get_config()


@router.put('/config')
async def put_config(body: FlywheelConfigUpdate, user: dict = Depends(get_current_director)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, 'no fields to update')
    cfg = await flywheel.update_config(patch)
    await add_event('DIRECTOR', f"FLYWHEEL CONFIG updated by {user['email']}: {', '.join(f'{k}={v}' for k, v in patch.items())}.")
    return cfg


@router.get('/ledger')
async def get_ledger(limit: int = Query(100, ge=1, le=500), type: str = Query(None)):
    q = {'type': type} if type else {}
    return await db.flywheel_ledger.find(q, {'_id': 0}).sort('created_at', -1).to_list(limit)


@router.get('/ledger.csv')
async def get_ledger_csv(type: str = Query(None)):
    q = {'type': type} if type else {}
    rows = await db.flywheel_ledger.find(q, {'_id': 0}).sort('created_at', -1).to_list(5000)
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=CSV_COLUMNS, extrasaction='ignore')
    w.writeheader()
    for r in rows:
        w.writerow(r)
    name = f"bash-flywheel-{type or 'all'}-{utcnow():%Y%m%d-%H%M}.csv"
    return Response(buf.getvalue(), media_type='text/csv', headers={'Content-Disposition': f'attachment; filename="{name}"'})


@router.get('/history')
async def get_history(hours: int = Query(24, ge=1, le=48)):
    since = iso(utcnow() - timedelta(hours=hours))
    snaps = await db.token_snapshots.find({'t': {'$gte': since}}, {'_id': 0}).sort('t', 1).to_list(3000)
    injections = await db.flywheel_ledger.find({'type': 'injection'}, {'_id': 0}).sort('created_at', 1).to_list(1000)
    cum, series = 0.0, []
    for i in injections:
        cum += i['amount_sol']
        series.append({'t': i['created_at'], 'amount_sol': i['amount_sol'], 'cumulative_sol': cum, 'tokens': i['tokens_acquired'], 'trigger': i['trigger'], 'tx_signature': i.get('tx_signature')})
    return {'snapshots': snaps, 'injections': series}


@router.post('/inject')
async def inject_now(user: dict = Depends(get_current_director)):
    return await flywheel.try_inject('manual')
