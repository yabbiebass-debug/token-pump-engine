import random
from fastapi import APIRouter, HTTPException
from db import db
from models import WithdrawalCreate
from services import market
from services.events import add_event
from services.util import utcnow, iso, new_id

router = APIRouter(tags=['withdrawals'])
PRIORITY_FEE = 0.000005


async def vault_summary():
    payments = await db.payments.find({'method': 'SOLANA', 'status': 'confirmed'}, {'_id': 0}).to_list(1000)
    withdrawals = await db.withdrawals.find({'status': 'confirmed'}, {'_id': 0}).to_list(1000)
    deposited = sum(p.get('sol_amount') or 0 for p in payments)
    withdrawn = sum(w['amount_sol'] for w in withdrawals)
    return {'deposited_sol': deposited, 'withdrawn_sol': withdrawn, 'available_sol': max(0.0, deposited - withdrawn)}


@router.get('/withdrawals')
async def list_withdrawals():
    return await db.withdrawals.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)


@router.get('/vault')
async def get_vault():
    return await vault_summary()


@router.post('/withdrawals', status_code=201)
async def create_withdrawal(body: WithdrawalCreate):
    vault = await vault_summary()
    if body.amount_sol > vault['available_sol'] + 1e-9:
        raise HTTPException(400, f"insufficient vault balance: {vault['available_sol']:.4f} SOL available")
    sol_price = (await market.get_sol_price())['usd']
    doc = {
        'id': new_id('wth-'), 'amount_sol': body.amount_sol, 'amount_usd_est': round(body.amount_sol * sol_price, 2),
        'destination_wallet': body.destination_wallet, 'memo': body.memo, 'priority_fee_sol': PRIORITY_FEE, 'status': 'confirmed', 'created_at': iso(utcnow()),
    }
    if body.mode == 'attest':
        if not body.signature:
            raise HTTPException(400, 'signature required for on-chain attestation')
        try:
            v = await market.verify_signature(body.signature.strip())
        except Exception as e:
            raise HTTPException(502, f'rpc verification failed: {e}')
        if not v['valid']:
            raise HTTPException(400, 'signature not found on Solana mainnet')
        doc.update({'tx_signature': body.signature.strip(), 'tx_mode': 'onchain', 'slot': v.get('slot'), 'verified_onchain': True})
    else:
        nonce = ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=10))
        doc.update({'tx_signature': f"YABBAI-LEDGER-{nonce}", 'tx_mode': 'simulated', 'verified_onchain': False})
    await db.withdrawals.insert_one(dict(doc))
    await add_event('TREASURER', f"TREASURY DISPATCH [{doc['tx_mode'].upper()}]: {body.amount_sol} SOL (~${doc['amount_usd_est']}) → {body.destination_wallet[:6]}…{body.destination_wallet[-4:]} · {doc['tx_signature'][:14]}…", 'success')
    return doc
