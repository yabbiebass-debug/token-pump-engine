from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from db import db
from constants import PACKAGES, TIERS, SOL_RECIPIENT, PROMO_CODE, PROMO_DISCOUNT
from models import PaymentCreate, SIGNATURE_RE
from services import flywheel, market, treasury
from services.events import add_event
from services.util import utcnow, iso, new_id

router = APIRouter(tags=['payments'])
MIN_RATIO = 0.97


class VerifySolRequest(BaseModel):
    signature: str = Field(pattern=SIGNATURE_RE)
    expected_sol: float = Field(gt=0)


class QuoteRequest(BaseModel):
    package: str = 'Merge'
    custom_fee: int | None = None
    promo_code: str = ''


def price_quote(package: str, custom_fee, promo_code: str) -> dict:
    pkg = next((p for p in PACKAGES if p['name'] == package), None)
    if package == 'Custom':
        if not custom_fee or custom_fee < 500:
            raise HTTPException(400, 'custom fee must be at least $500')
        raw_fee = int(custom_fee)
    elif pkg:
        raw_fee = pkg['fee']
    else:
        raise HTTPException(400, 'unknown package')
    discount = PROMO_DISCOUNT if promo_code.strip().upper() == PROMO_CODE else 0
    return {'raw_fee_usd': raw_fee, 'discount_usd': discount, 'fee_usd': max(100, raw_fee - discount)}


async def verify_sol_payment(signature: str, expected_sol: float) -> dict:
    signature = signature.strip()
    result = {'valid': False, 'signature': signature, 'expected_sol': expected_sol, 'min_ratio': MIN_RATIO, 'received_sol': 0.0,
              'ratio': 0.0, 'slot': None, 'block_time': None, 'already_used': False, 'tx_error': None, 'recipient': SOL_RECIPIENT, 'payer': None}
    used = await db.payments.find_one({'tx_signature': signature}, {'_id': 0, 'id': 1, 'biz': 1})
    if used:
        result.update({'already_used': True, 'reason': f"Signature already used for payment {used['id']} ({used['biz']})"})
        return result
    try:
        tx = await market.fetch_tx_retry(signature, attempts=3, delay=2.0)
    except ValueError:
        result['reason'] = 'Malformed transaction signature'
        return result
    except Exception as e:
        result['reason'] = f'RPC lookup failed: {e}'
        return result
    if not tx:
        result['reason'] = 'Signature not found on Solana mainnet (or not yet confirmed)'
        return result
    result.update({'slot': tx.get('slot'), 'block_time': tx.get('blockTime'), 'tx_error': tx['meta'].get('err')})
    if tx['meta'].get('err'):
        result['reason'] = 'Transaction failed on-chain'
        return result
    received = market.sol_received_by(tx, SOL_RECIPIENT)
    if received is None:
        result['reason'] = 'Transaction does not involve the treasury wallet'
        return result
    result['received_sol'] = received
    result['ratio'] = received / expected_sol if expected_sol else 0
    result['payer'] = treasury.counterparty(tx, received)[0]
    if received <= 0:
        result['reason'] = f'Treasury balance did not increase in this transaction ({received:.6f} SOL)'
        return result
    if result['ratio'] < MIN_RATIO:
        result['reason'] = f'Received {received:.4f} SOL is only {result["ratio"] * 100:.1f}% of the quoted {expected_sol:.4f} SOL (min {MIN_RATIO * 100:.0f}%)'
        return result
    result.update({'valid': True, 'reason': f'Verified: {received:.4f} SOL received by treasury at slot {tx.get("slot")}'})
    return result


@router.post('/payments/quote')
async def quote_payment(body: QuoteRequest):
    q = price_quote(body.package, body.custom_fee, body.promo_code)
    sol_price = (await market.get_sol_price())['usd']
    return {**q, 'sol_price_usd': sol_price, 'sol_amount': q['fee_usd'] / sol_price, 'recipient': SOL_RECIPIENT, 'min_ratio': MIN_RATIO}


@router.post('/payments/verify-sol')
async def verify_sol(body: VerifySolRequest):
    return await verify_sol_payment(body.signature, body.expected_sol)


@router.get('/payments')
async def list_payments():
    return await db.payments.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)


@router.post('/payments', status_code=201)
async def create_payment(body: PaymentCreate):
    q = price_quote(body.package, body.custom_fee, body.promo_code)
    fee = q['fee_usd']
    tier = next((t for t in TIERS if t['name'] == body.tier), TIERS[1])
    sol_price = (await market.get_sol_price())['usd']
    expected_sol = fee / sol_price
    verification = await verify_sol_payment(body.sol_signature, expected_sol)
    if not verification['valid']:
        raise HTTPException(400, verification['reason'])
    now = iso(utcnow())
    client_id = new_id('client-')
    payment = {
        'id': new_id('pay-'), 'method': 'SOLANA', 'purpose': f"{body.package} Package Build", 'biz': body.biz.strip(), 'email': body.email.strip(),
        'package': body.package, 'tier': tier['name'], 'amount_usd': fee, 'mrr': tier['mrr'], 'discount_usd': q['discount_usd'],
        'status': 'confirmed', 'client_id': client_id, 'created_at': now,
        'reference': verification['signature'], 'tx_signature': verification['signature'], 'sol_amount': round(verification['received_sol'], 9),
        'quoted_sol': round(expected_sol, 9), 'sol_price_usd': sol_price, 'recipient': SOL_RECIPIENT, 'payer_wallet': verification.get('payer') or body.payer_wallet.strip() or None,
        'slot': verification['slot'], 'block_time': verification['block_time'], 'verified_onchain': True,
    }
    client = {
        'id': client_id, 'biz': payment['biz'], 'package': body.package, 'setup_fee': fee, 'setup_paid': True, 'tier': tier['name'], 'mrr': tier['mrr'],
        'status': 'QUEUED', 'build_pct': 0, 'health': 'GREEN', 'created_via': 'SOLANA', 'created_at': now, 'payment_id': payment['id'],
        'deliverables': ['Upstream repo selection and license clearance', 'Rebrand, config, and niche defaults', 'Release with README, demo, and install guide'],
        'techStack': [], 'primaryContact': body.email.strip() or 'Director intake', 'scope': body.scope.strip(),
    }
    await db.payments.insert_one(dict(payment))
    await db.clients.insert_one(dict(client))
    market.invalidate(f'wallet:{SOL_RECIPIENT}')
    await add_event('TREASURER', f"PAYMENT VERIFIED ON-CHAIN: {payment['sol_amount']:.4f} SOL (${fee:,}) from {payment['biz']} ({body.package} · {tier['name']}) · slot {payment['slot']}. Build queued.", 'success')
    fly = await flywheel.allocate_from_payment(payment)
    await treasury.sync_if_stale(0)
    return {'payment': payment, 'client': client, 'flywheel': fly, 'verification': verification}
