import logging
import time
from datetime import datetime, timezone
from fastapi import HTTPException
from db import db
from constants import SOL_RECIPIENT, TOKEN_MINT
from services import flywheel, market
from services.events import add_event
from services.util import utcnow, iso, new_id

log = logging.getLogger('treasury')
_last_sync = 0.0


def _keys(tx):
    return [k['pubkey'] if isinstance(k, dict) else k for k in tx['transaction']['message']['accountKeys']]


def classify(tx):
    delta = market.sol_received_by(tx, SOL_RECIPIENT)
    if delta is None:
        return None, None, 0.0
    tok = market.token_delta_for(tx, SOL_RECIPIENT, TOKEN_MINT)
    if tx['meta'].get('err'):
        kind = 'failed'
    elif tok > 1e-9 and delta < 0:
        kind = 'buyback'
    elif tok < -1e-9:
        kind = 'token_out'
    elif delta > 0:
        kind = 'deposit'
    elif delta < 0:
        kind = 'transfer_out'
    else:
        kind = 'other'
    return kind, delta, tok


def counterparty(tx, delta):
    keys, pre, post = _keys(tx), tx['meta']['preBalances'], tx['meta']['postBalances']
    best, best_k = 0.0, None
    for i, k in enumerate(keys):
        if k == SOL_RECIPIENT:
            continue
        d = (post[i] - pre[i]) / 1e9
        if (delta > 0 and d < best) or (delta < 0 and d > best):
            best, best_k = d, k
    return best_k, abs(best)


async def vault_summary():
    sol_price = (await market.get_sol_price())['usd']
    try:
        w = await market.get_wallet(SOL_RECIPIENT)
        tokens = await market.get_token_balance(SOL_RECIPIENT, TOKEN_MINT)
        bal, slot, ok, err = w['balance_sol'], w['slot'], True, None
    except Exception as e:
        log.warning('vault snapshot failed: %s', e)
        bal, slot, tokens, ok, err = None, None, None, False, str(e)
    try:
        price_sol = (await market.get_token_live())['price_sol']
    except Exception:
        price_sol = 0.0
    payments = await db.payments.find({'verified_onchain': True}, {'_id': 0, 'sol_amount': 1, 'amount_usd': 1}).to_list(5000)
    withdrawals = await db.withdrawals.find({'verified_onchain': True}, {'_id': 0, 'amount_sol': 1}).to_list(5000)
    st = await flywheel.get_state()
    return {
        'address': SOL_RECIPIENT, 'ok': ok, 'error': err, 'slot': slot, 'solscan_url': f'https://solscan.io/account/{SOL_RECIPIENT}',
        'balance_sol': bal, 'balance_usd': (bal or 0) * sol_price,
        'token_balance': tokens, 'token_value_sol': (tokens or 0) * price_sol, 'token_value_usd': (tokens or 0) * price_sol * sol_price,
        'deposited_sol': sum(p.get('sol_amount') or 0 for p in payments), 'deposited_usd': sum(p.get('amount_usd') or 0 for p in payments), 'payments_count': len(payments),
        'withdrawn_sol': sum(x['amount_sol'] for x in withdrawals), 'withdrawals_count': len(withdrawals),
        'buyback_spent_sol': st['total_injected_sol'], 'buyback_tokens': st['total_tokens_acquired'], 'buybacks_count': st['injections_count'],
        'reserve_sol': st['buyback_reserve_sol'], 'reserve_backed': (bal is None) or (bal >= st['buyback_reserve_sol']),
        'sol_price_usd': sol_price,
    }


async def _index(sig_info: dict):
    sig = sig_info['signature']
    tx = await market.get_transaction(sig)
    if not tx:
        return None
    kind, delta, tok = classify(tx)
    if kind is None:
        return None
    cp, cp_amount = counterparty(tx, delta)
    pay = await db.payments.find_one({'tx_signature': sig}, {'_id': 0, 'id': 1, 'biz': 1})
    wd = await db.withdrawals.find_one({'tx_signature': sig}, {'_id': 0, 'id': 1})
    led = await db.flywheel_ledger.find_one({'tx_signature': sig}, {'_id': 0, 'id': 1})
    bt = tx.get('blockTime') or sig_info.get('blockTime')
    doc = {'id': new_id('ta-'), 'signature': sig, 'slot': tx.get('slot') or sig_info.get('slot'), 'block_time': bt,
           'created_at': iso(datetime.fromtimestamp(bt, tz=timezone.utc)) if bt else iso(utcnow()), 'kind': kind,
           'sol_delta': delta, 'token_delta': tok, 'fee_sol': (tx['meta'].get('fee') or 0) / 1e9, 'counterparty': cp, 'counterparty_delta_sol': cp_amount,
           'payment_id': pay['id'] if pay else None, 'payment_biz': pay['biz'] if pay else None,
           'withdrawal_id': wd['id'] if wd else None, 'ledger_id': led['id'] if led else None, 'err': tx['meta'].get('err'), 'seen_at': iso(utcnow())}
    await db.treasury_activity.insert_one(dict(doc))
    return doc


async def index_signature(signature: str):
    existing = await db.treasury_activity.find_one({'signature': signature}, {'_id': 0})
    if existing:
        return existing
    try:
        return await _index({'signature': signature})
    except Exception as e:
        log.warning('index %s failed: %s', signature[:10], e)
        return None


async def sync_activity(limit: int = 25):
    global _last_sync
    sigs = await market.rpc('getSignaturesForAddress', [SOL_RECIPIENT, {'limit': limit}])
    known = {d['signature'] async for d in db.treasury_activity.find({'signature': {'$in': [s['signature'] for s in sigs]}}, {'signature': 1})}
    added = []
    for s in sigs:
        if s['signature'] in known:
            continue
        try:
            doc = await _index(s)
        except Exception as e:
            log.warning('tx fetch failed %s: %s', s['signature'][:10], e)
            continue
        if doc:
            added.append(doc)
    _last_sync = time.time()
    if added:
        log.info('treasury activity: %d new on-chain tx', len(added))
    return added


async def sync_if_stale(max_age: float = 45):
    if time.time() - _last_sync < max_age:
        return []
    try:
        return await sync_activity()
    except Exception as e:
        log.warning('treasury sync failed: %s', e)
        return []


async def list_activity(limit: int = 60):
    return await db.treasury_activity.find({}, {'_id': 0}).sort([('block_time', -1), ('created_at', -1)]).to_list(limit)


async def record_withdrawal(signature: str, memo: str, user: dict) -> dict:
    signature = signature.strip()
    if await db.withdrawals.find_one({'tx_signature': signature}):
        raise HTTPException(409, 'This transaction is already recorded as a withdrawal')
    try:
        tx = await market.fetch_tx_retry(signature)
    except ValueError:
        raise HTTPException(422, 'Malformed transaction signature')
    if not tx:
        raise HTTPException(409, 'Transaction not confirmed yet — wait a few seconds and retry')
    if tx['meta'].get('err'):
        raise HTTPException(422, f"Transaction failed on-chain: {tx['meta']['err']}")
    kind, delta, _ = classify(tx)
    if kind is None:
        raise HTTPException(422, 'Transaction does not involve the treasury wallet')
    if kind != 'transfer_out':
        raise HTTPException(422, f'Transaction is a {kind}, not a SOL transfer out of the treasury')
    dest, amount = counterparty(tx, delta)
    if not dest or amount <= 0:
        raise HTTPException(422, 'Could not identify the destination wallet in this transaction')
    sol_price = (await market.get_sol_price())['usd']
    doc = {'id': new_id('wth-'), 'amount_sol': amount, 'fee_sol': (tx['meta'].get('fee') or 0) / 1e9, 'total_out_sol': -delta, 'amount_usd_est': round(amount * sol_price, 2),
           'destination_wallet': dest, 'memo': memo.strip() or 'Director treasury transfer', 'status': 'confirmed', 'created_at': iso(utcnow()), 'authorised_by': user['email'],
           'tx_signature': signature, 'slot': tx.get('slot'), 'block_time': tx.get('blockTime'), 'verified_onchain': True}
    await db.withdrawals.insert_one(dict(doc))
    market.invalidate(f'wallet:{SOL_RECIPIENT}', f'tokbal:{SOL_RECIPIENT}:{TOKEN_MINT}')
    await add_event('TREASURER', f"TREASURY TRANSFER VERIFIED ON-CHAIN: {amount:.4f} SOL (~${doc['amount_usd_est']}) → {dest[:6]}…{dest[-4:]} · slot {tx.get('slot')} · {signature[:12]}…", 'success')
    try:
        await sync_activity()
    except Exception as e:
        log.warning('post-withdrawal sync failed: %s', e)
    return doc
