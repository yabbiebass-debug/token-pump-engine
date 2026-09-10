"""Hot-wallet auto-buy executor: quote → swap → sign → send → confirm → ledger.

Runs fully server-side when EXECUTOR_ENABLED=true and EXECUTOR_SECRET_KEY
is set. Every buy respects: min_injection floor, window capacity cap,
treasury SOL floor, slippage cap. Every result is ledgered with the
on-chain signature so the frontend charts stay truthful.
"""
import asyncio
import logging

from db import db
from constants import GRADUATION_SOL, TOKEN_MINT
from services import flywheel, market, signer, telegram
from services.events import add_event
from services.util import iso, parse, utcnow

log = logging.getLogger('executor')


async def _send_and_confirm(signed_b64: str, timeout_s: float = 60.0) -> str:
    sig = await market.rpc('sendTransaction', [signed_b64, {'encoding': 'base64', 'skipPreflight': False, 'preflightCommitment': 'confirmed'}])
    deadline = utcnow().timestamp() + timeout_s
    while utcnow().timestamp() < deadline:
        st = await market.verify_signature(sig)
        if st['valid'] and not st.get('err') and st.get('status') in ('confirmed', 'finalized'):
            return sig
        if st['valid'] and st.get('err'):
            raise RuntimeError(f'tx failed on-chain: {st["err"]}')
        await asyncio.sleep(3)
    # Last chance: fetch the tx directly; RPC status can lag the ledger.
    tx = await market.get_transaction(sig)
    if tx and not tx['meta'].get('err'):
        return sig
    raise RuntimeError('swap not confirmed within timeout')


async def execute_buy(amount_sol: float, trigger: str, signed_by: str = 'executor') -> dict:
    """Execute one hot-wallet buy of $BASH for `amount_sol` SOL. Returns ledger entry."""
    cfg, st = await flywheel.get_config(), await flywheel.get_state()
    now = utcnow()
    flywheel.roll_window(st, cfg, now)

    if not signer.executor_enabled():
        raise RuntimeError('executor disabled — set EXECUTOR_ENABLED=true + EXECUTOR_SECRET_KEY')
    if amount_sol < cfg['min_injection_sol']:
        return {'status': 'below_min', 'reserve_sol': st['buyback_reserve_sol']}
    cap_left = max(0.0, cfg['hourly_capacity_sol'] - st['window_injected_sol'])
    if cap_left <= 1e-12:
        return {'status': 'delayed', 'cap_sol': cfg['hourly_capacity_sol']}

    amount_sol = min(amount_sol, cap_left, st['buyback_reserve_sol'])
    _, hot = signer.load_keypair()
    if hot != cfg['signer_wallet']:
        raise RuntimeError(f"hot wallet {hot[:6]}… != configured signer {cfg['signer_wallet'][:6]}… — refusing to sign")

    snap_sol = (await market.get_wallet(hot))['balance_sol']
    if snap_sol - amount_sol < cfg['min_wallet_balance_sol']:
        raise RuntimeError(f'hot wallet {snap_sol:.4f} SOL — buying {amount_sol:.4f} would breach {cfg["min_wallet_balance_sol"]} floor')

    slippage = int(cfg['max_slippage_bps'])
    q = await market.jup_quote(int(round(amount_sol * 1e9)), slippage)
    if not q.get('routePlan'):
        raise RuntimeError('Jupiter returned no route for $BASH right now')
    out_tokens = int(q['outAmount']) / 1e6
    swap = await market.jup_swap(q, hot)
    if not swap.get('swapTransaction'):
        raise RuntimeError('Jupiter did not return a transaction')
    signed_b64 = signer.sign_versioned_tx(swap['swapTransaction'])
    sig = await _send_and_confirm(signed_b64)

    tx = await market.fetch_tx_retry(sig)
    spent = -market.sol_received_by(tx, hot)
    tokens = market.token_delta_for(tx, hot, TOKEN_MINT)
    if spent <= 0 or tokens <= 0:
        raise RuntimeError(f'confirmed tx bought nothing (SOL {spent:.6f}, $BASH {tokens:,.0f})')

    market.invalidate('pump', 'dex', 'token_live', f'wallet:{hot}', f'tokbal:{hot}:{TOKEN_MINT}')
    live = await market.get_token_live()
    st = await flywheel.get_state()
    flywheel.roll_window(st, cfg, utcnow())
    st['buyback_reserve_sol'] = max(0.0, st['buyback_reserve_sol'] - spent)
    st['window_injected_sol'] += spent
    st['total_injected_sol'] += spent
    st['total_tokens_acquired'] += tokens
    st['injections_count'] += 1
    st['last_injection_at'] = iso(utcnow())
    await flywheel.save_state(st)
    avg = spent / tokens
    entry = await flywheel.ledger_add(
        'injection', amount_sol=spent, amount_usd=spent * live['sol_price_usd'],
        tokens_acquired=tokens, avg_price_sol=avg,
        price_before_sol=amount_sol / out_tokens if out_tokens else avg,
        price_after_sol=live['price_sol'],
        impact_pct=float(q.get('priceImpactPct') or 0) * 100,
        trigger=trigger, mode='HOT_WALLET',
        curve_progress_after_pct=live['curve_progress_pct'],
        sol_price_usd=live['sol_price_usd'],
        reserve_after=st['buyback_reserve_sol'], tx_signature=sig,
        slot=tx.get('slot'), block_time=tx.get('blockTime'),
        signer_wallet=hot, signed_by=signed_by)
    await db.buyback_intents.insert_one({
        'id': f"ex-{sig[:8]}", 'status': 'executed', 'amount_sol': spent,
        'trigger': trigger, 'created_at': iso(utcnow()), 'executed_at': iso(utcnow()),
        'tx_signature': sig, 'spent_sol': spent, 'tokens': tokens})
    await add_event('INJECTOR', f"AUTO-BUY EXECUTED: {spent:.4f} SOL → {tokens:,.0f} $BASH · tx {sig[:12]}… · curve {live['curve_progress_pct']:.3f}% of {GRADUATION_SOL:.0f} SOL ({trigger}).", 'success')
    try:
        telegram.fire('injection', telegram.injection_text(entry, st['buyback_reserve_sol']))
    except Exception as e:
        log.warning('telegram fire failed: %s', e)
    return {'status': 'executed', **entry}


async def drain_reserve(trigger: str = 'auto') -> list:
    """Spend the whole releasable reserve within governor limits, one tx per window-slot.

    Returns the list of per-buy results. Stops on below_min / delayed / error.
    """
    results = []
    for _ in range(5):  # hard cap: max 5 buys per drain so one tick can't spam
        cfg, st = await flywheel.get_config(), await flywheel.get_state()
        flywheel.roll_window(st, cfg, utcnow())
        await flywheel.save_state(st)
        cap_left = max(0.0, cfg['hourly_capacity_sol'] - st['window_injected_sol'])
        amt = min(st['buyback_reserve_sol'], cap_left)
        if amt < cfg['min_injection_sol'] or cap_left <= 1e-12:
            if cap_left <= 1e-12 and st['buyback_reserve_sol'] >= cfg['min_injection_sol']:
                resumes = iso(parse(st['window_start']) + __import__('datetime').timedelta(minutes=cfg['window_min']))
                st['delays_count'] += 1
                st['last_delay_resumes_at'] = resumes
                await flywheel.save_state(st)
                entry = await flywheel.ledger_add('delayed', amount_sol=st['buyback_reserve_sol'], reason='capacity_reached', trigger=trigger, resumes_at=resumes, cap_sol=cfg['hourly_capacity_sol'])
                results.append({'status': 'delayed', **entry})
            else:
                results.append({'status': 'below_min', 'reserve_sol': st['buyback_reserve_sol']})
            break
        try:
            results.append(await execute_buy(amt, trigger))
        except Exception as e:
            log.warning('auto-buy failed: %s', e)
            await flywheel.ledger_add('failed', amount_sol=amt, reason=str(e)[:300], trigger=trigger, mode='HOT_WALLET')
            results.append({'status': 'failed', 'error': str(e)[:300]})
            break
    return results


async def auto_tick(now) -> dict:
    """Scheduler entry: roll window, dump reserve via hot wallet if enabled."""
    cfg, st = await flywheel.get_config(), await flywheel.get_state()
    rolled = flywheel.roll_window(st, cfg, now)
    await flywheel.save_state(st)
    out = {'rolled': rolled, 'executor': signer.executor_enabled(), 'buys': []}
    if rolled:
        await flywheel.dismiss_pending_intents('auto-executor drained on window roll — intent superseded')
    if signer.executor_enabled() and st['buyback_reserve_sol'] >= cfg['min_injection_sol']:
        cap_left = max(0.0, cfg['hourly_capacity_sol'] - st['window_injected_sol'])
        if cap_left > 1e-12:
            out['buys'] = await drain_reserve('auto_tick')
    return out
