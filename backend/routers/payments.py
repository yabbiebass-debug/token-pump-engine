import random
from fastapi import APIRouter, HTTPException
from db import db
from constants import PACKAGES, TIERS, SOL_RECIPIENT, PROMO_CODE, PROMO_DISCOUNT
from models import PaymentCreate
from services import flywheel, market
from services.events import add_event
from services.util import utcnow, iso, new_id

router = APIRouter(tags=['payments'])
METHOD = {'card': 'CARD', 'paypal': 'PAYPAL', 'solana': 'SOLANA'}


def _reference(method: str, sol_sig: str) -> str:
    tail = ''.join(random.choices('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', k=7))
    if method == 'card':
        return f'TXN-STR-{random.randint(100000, 999999)}'
    if method == 'paypal':
        return f'PP-ORD-{random.randint(1000000, 9999999)}'
    return sol_sig[:88] if sol_sig else f'SIM-{tail}'


@router.get('/payments')
async def list_payments():
    return await db.payments.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)


@router.post('/payments', status_code=201)
async def create_payment(body: PaymentCreate):
    pkg = next((p for p in PACKAGES if p['name'] == body.package), None)
    if body.package == 'Custom':
        if not body.custom_fee or body.custom_fee < 500:
            raise HTTPException(400, 'custom fee must be at least $500')
        raw_fee = int(body.custom_fee)
    elif pkg:
        raw_fee = pkg['fee']
    else:
        raise HTTPException(400, 'unknown package')
    tier = next((t for t in TIERS if t['name'] == body.tier), TIERS[1])
    discount = PROMO_DISCOUNT if body.promo_code.strip().upper() == PROMO_CODE else 0
    fee = max(100, raw_fee - discount)
    sol_price = (await market.get_sol_price())['usd']
    now = iso(utcnow())
    client_id = new_id('client-')
    payment = {
        'id': new_id('pay-'), 'method': METHOD[body.method], 'purpose': f"{body.package} Package Build", 'biz': body.biz.strip(),
        'package': body.package, 'tier': tier['name'], 'amount_usd': fee, 'mrr': tier['mrr'], 'discount_usd': discount,
        'reference': _reference(body.method, body.sol_signature.strip()), 'status': 'confirmed', 'client_id': client_id,
        'created_at': now, 'simulated': True,
    }
    if body.method == 'solana':
        payment.update({'sol_amount': round(fee / sol_price, 4), 'recipient': SOL_RECIPIENT})
    client = {
        'id': client_id, 'biz': payment['biz'], 'package': body.package, 'setup_fee': fee, 'setup_paid': True, 'tier': tier['name'], 'mrr': tier['mrr'],
        'status': 'QUEUED', 'build_pct': 0, 'health': 'GREEN', 'created_via': payment['method'], 'created_at': now,
        'deliverables': ['Upstream repo selection and license clearance', 'Rebrand, config, and niche defaults', 'Release with README, demo, and install guide'],
        'techStack': [], 'primaryContact': body.email.strip() or 'Director intake', 'scope': body.scope.strip(),
    }
    await db.payments.insert_one(dict(payment))
    await db.clients.insert_one(dict(client))
    await add_event('TREASURER', f"NEW PAYMENT CONFIRMED [DEMO]: ${fee:,} via {payment['method']} for {payment['biz']} ({body.package} · {tier['name']}). Build queued.", 'success')
    fly = await flywheel.allocate_from_payment(payment)
    return {'payment': payment, 'client': client, 'flywheel': fly}
