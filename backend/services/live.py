import logging
from fastapi import HTTPException
from db import db
from constants import TOKEN_MINT, GRADUATION_SOL
from services import flywheel, market, telegram
from services.events import add_event
from services.util import utcnow, iso, parse

log = logging.getLogger('live')


async def wallet_snapshot(address: str) -> dict:
    try:
        w = await market.get_wallet(address)
        tokens = await market.get_token_balance(address, TOKEN_MINT)
        return {'address': address, 'balance_sol': w['balance_sol'], 'token_balance': tokens, 'slot': w['slot'], 'solscan_url': w['solscan_url'], 'ok': True}
    except Exception as e:
        log.warning('wallet snapshot failed: %s', e)
        return {'address': address, 'balance_sol': None, 'token_balance': None, 'ok': False, 'error': str(e)}


async def live_status() -> dict:
    cfg = await flywheel.get_config()
    st = await flywheel.get_state()
    wallet = await wallet_snapshot(cfg['signer_wallet'])
    sol_price = (await market.get_sol_price())['usd']
    try:
        price_sol = (await market.get_token_live())['price_sol']
    except Exception:
        price_sol = 0.0
    recent = await db.flywheel_ledger.find({'type': 'injection'}, {'_id': 0}).sort('created_at', -1).to_list(20)
    return {
        'mode': flywheel.MODE, 'signer_wallet': cfg['signer_wallet'],
        'min_wallet_balance_sol': cfg['min_wallet_balance_sol'], 'max_slippage_bps': cfg['max_slippage_bps'], 'min_injection_sol': cfg['min_injection_sol'],
        'wallet': {**wallet, 'balance_usd': (wallet['balance_sol'] or 0) * sol_price, 'token_value_sol': (wallet['token_balance'] or 0) * price_sol,
                   'token_value_usd': (wallet['token_balance'] or 0) * price_sol * sol_price},
        'pending_intent': await flywheel.get_pending_intent(),
        'injections_count': st['injections_count'], 'sol_spent': st['total_injected_sol'], 'tokens_acquired': st['total_tokens_acquired'],
        'recent': recent, 'sol_price_usd': sol_price,
    }


async def quote(amount_sol: float, slippage_bps: int) -> dict:
    q = await market.jup_quote(int(round(amount_sol * 1e9)), slippage_bps)
    if not q.get('routePlan'):
        raise HTTPException(422, 'No swap route for $BASH right now (Jupiter returned no route)')
    out = int(q['outAmount']) / 1e6
    return {'in_sol': amount_sol, 'out_tokens': out, 'min_out_tokens': int(q.get('otherAmountThreshold') or 0) / 1e6,
            'price_impact_pct': float(q.get('priceImpactPct') or 0) * 100, 'avg_price_sol': amount_sol / out if out else 0,
            'route': [p['swapInfo']['label'] for p in q['routePlan']], 'slippage_bps': int(q.get('slippageBps') or slippage_bps), 'raw': q}


async def build(intent_id: str, wallet: str, amount_sol: float, slippage_bps: int, user: dict) -> dict:
    cfg = await flywheel.get_config()
    if wallet != cfg['signer_wallet']:
        raise HTTPException(403, f"Connected wallet is not the disclosed treasury signer ({cfg['signer_wallet'][:6]}…)")
    intent = await db.buyback_intents.find_one({'id': intent_id, 'status': 'awaiting_signature'}, {'_id': 0})
    if not intent:
        raise HTTPException(404, 'No pending buyback intent with that id')
    amount = min(float(amount_sol), float(intent['amount_sol']) + 1e-9)
    if amount < cfg['min_injection_sol']:
        raise HTTPException(400, f"Amount below minimum injection ({cfg['min_injection_sol']} SOL)")
    market.invalidate(f'wallet:{wallet}')
    snap = await wallet_snapshot(wallet)
    if not snap['ok']:
        raise HTTPException(502, f"Could not read wallet balance: {snap.get('error')}")
    if snap['balance_sol'] - amount < cfg['min_wallet_balance_sol']:
        raise HTTPException(400, f"Wallet holds {snap['balance_sol']:.4f} SOL; buying {amount:.4f} SOL would breach the {cfg['min_wallet_balance_sol']} SOL floor kept for fees/rent")
    slippage = max(10, min(int(slippage_bps or cfg['max_slippage_bps']), int(cfg['max_slippage_bps'])))
    q = await quote(amount, slippage)
    try:
        swap = await market.jup_swap(q['raw'], wallet)
    except Exception as e:
        raise HTTPException(502, f'Jupiter swap build failed: {e}')
    if not swap.get('swapTransaction'):
        raise HTTPException(502, 'Jupiter did not return a transaction')
    q.pop('raw', None)
    await db.buyback_intents.update_one({'id': intent_id}, {'$set': {'built_at': iso(utcnow()), 'built_amount_sol': amount, 'built_by': user['email'],
                                                                     'quote': q, 'last_valid_block_height': swap.get('lastValidBlockHeight')}})
    await add_event('INJECTOR', f"BUYBACK BUILT: {amount:.4f} SOL → ~{q['out_tokens']:,.0f} $BASH via {' → '.join(q['route'])} (impact {q['price_impact_pct']:.2f}%). Waiting for wallet signature.")
    return {'intent_id': intent_id, 'amount_sol': amount, 'swap_transaction': swap['swapTransaction'], 'last_valid_block_height': swap.get('lastValidBlockHeight'),
            'quote': q, 'simulation_error': swap.get('simulationError'), 'prioritization_fee_lamports': swap.get('prioritizationFeeLamports')}


async def confirm(intent_id: str, signature: str, user: dict) -> dict:
    cfg = await flywheel.get_config()
    signature = signature.strip()
    intent = await db.buyback_intents.find_one({'id': intent_id, 'status': 'awaiting_signature'}, {'_id': 0})
    if not intent:
        raise HTTPException(404, 'No pending buyback intent with that id')
    if await db.flywheel_ledger.find_one({'tx_signature': signature}):
        raise HTTPException(409, 'This signature is already ledgered')
    try:
        tx = await market.fetch_tx_retry(signature)
    except ValueError:
        raise HTTPException(422, 'Malformed transaction signature')
    if not tx:
        raise HTTPException(409, 'Transaction not confirmed yet — wait a few seconds and retry confirmation')
    if tx['meta'].get('err'):
        await db.buyback_intents.update_one({'id': intent_id}, {'$set': {'last_error': str(tx['meta']['err']), 'last_failed_signature': signature}})
        raise HTTPException(422, f"Transaction failed on-chain: {tx['meta']['err']}")
    if tx.get('blockTime') and tx['blockTime'] < parse(intent['created_at']).timestamp() - 120:
        raise HTTPException(422, 'Transaction predates this buyback intent — only a transaction signed after the governor released it can be ledgered')
    signer = cfg['signer_wallet']
    delta = market.sol_received_by(tx, signer)
    if delta is None:
        raise HTTPException(422, 'Transaction does not involve the treasury signer wallet')
    spent = -delta
    tokens = market.token_delta_for(tx, signer, TOKEN_MINT)
    if spent <= 0 or tokens <= 0:
        raise HTTPException(422, f'Transaction did not buy $BASH for the treasury (SOL Δ {delta:.6f}, $BASH Δ {tokens:,.0f})')
    market.invalidate('pump', 'dex', 'token_live', f'wallet:{signer}', f'tokbal:{signer}:{TOKEN_MINT}')
    live = await market.get_token_live()
    st = await flywheel.get_state()
    now = utcnow()
    flywheel.roll_window(st, cfg, now)
    st['buyback_reserve_sol'] = max(0.0, st['buyback_reserve_sol'] - spent)
    st['window_injected_sol'] += spent
    st['total_injected_sol'] += spent
    st['total_tokens_acquired'] += tokens
    st['injections_count'] += 1
    st['last_injection_at'] = iso(now)
    await flywheel.save_state(st)
    q = intent.get('quote') or {}
    avg = spent / tokens
    entry = await flywheel.ledger_add('injection', amount_sol=spent, amount_usd=spent * live['sol_price_usd'], tokens_acquired=tokens, avg_price_sol=avg,
                                      price_before_sol=q.get('avg_price_sol') or avg, price_after_sol=live['price_sol'], impact_pct=q.get('price_impact_pct') or 0.0,
                                      trigger=intent['trigger'], mode='LIVE', curve_progress_after_pct=live['curve_progress_pct'], sol_price_usd=live['sol_price_usd'],
                                      reserve_after=st['buyback_reserve_sol'], tx_signature=signature, slot=tx.get('slot'), block_time=tx.get('blockTime'),
                                      signer_wallet=signer, signed_by=user['email'], intent_id=intent_id)
    await db.buyback_intents.update_one({'id': intent_id}, {'$set': {'status': 'executed', 'executed_at': iso(now), 'tx_signature': signature, 'spent_sol': spent, 'tokens': tokens}})
    await add_event('INJECTOR', f"BUYBACK EXECUTED ON-CHAIN: {spent:.4f} SOL → {tokens:,.0f} $BASH · tx {signature[:12]}… · curve {live['curve_progress_pct']:.3f}% of {GRADUATION_SOL:.0f} SOL.", 'success')
    telegram.fire('injection', telegram.injection_text(entry, st['buyback_reserve_sol']))
    return {'status': 'executed', **entry}


async def dismiss(intent_id: str, user: dict) -> dict:
    res = await db.buyback_intents.find_one_and_update({'id': intent_id, 'status': 'awaiting_signature'},
                                                      {'$set': {'status': 'dismissed', 'dismissed_by': user['email'], 'updated_at': iso(utcnow())}},
                                                      projection={'_id': 0}, return_document=True)
    if not res:
        raise HTTPException(404, 'No pending buyback intent with that id')
    await add_event('DIRECTOR', f"Buyback intent {intent_id} ({res['amount_sol']:.4f} SOL) dismissed by {user['email']}. Reserve untouched.")
    return res
