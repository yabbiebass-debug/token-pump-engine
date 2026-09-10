"""Profit-splitter: 50% → main wallet, 35% → satellite rebuy loop, 15% → fee buffer.

Runs after profitable exits (Director-confirmed sells or PumpSwap migration
proceeds). Splits withdrawable SOL per the standing policy, ledgering every
leg. Satellite legs feed straight back into the buyback reserve so the
flywheel re-pumps on the next tick — the iterative volume loop.
"""
import logging

from db import db
from services import flywheel
from services.events import add_event
from services.util import iso, new_id, utcnow

log = logging.getLogger('splitter')

POLICY = {'main_pct': 0.50, 'rebuy_pct': 0.35, 'buffer_pct': 0.15}


async def get_policy() -> dict:
    doc = await db.split_policy.find_one({'key': 'policy'}, {'_id': 0})
    return {**POLICY, **(doc or {})}


async def set_policy(patch: dict) -> dict:
    clean = {k: float(v) for k, v in patch.items() if k in POLICY}
    if clean and abs(sum({**POLICY, **clean}.values()) - 1.0) > 1e-9:
        raise ValueError('split policy must sum to 1.0')
    await db.split_policy.update_one({'key': 'policy'}, {'$set': clean}, upsert=True)
    return await get_policy()


async def split_profit(total_sol: float, main_wallet: str, trigger: str, tx_signature: str = None) -> dict:
    """Split `total_sol` per policy. Rebuy leg lands in the buyback reserve."""
    policy = await get_policy()
    if total_sol <= 0:
        raise ValueError('nothing to split')
    main = total_sol * policy['main_pct']
    rebuy = total_sol * policy['rebuy_pct']
    buf = total_sol - main - rebuy

    st = await flywheel.get_state()
    st['buyback_reserve_sol'] += rebuy
    await flywheel.save_state(st)
    await flywheel.ledger_add('allocation', amount_sol=rebuy, amount_usd=0.0,
                              reserve_after=st['buyback_reserve_sol'], source='profit_rebuy',
                              trigger=trigger, tx_signature=tx_signature)

    doc = {'id': new_id('sp-'), 'created_at': iso(utcnow()), 'type': 'profit_split',
           'total_sol': total_sol, 'main_sol': main, 'rebuy_sol': rebuy, 'buffer_sol': buf,
           'main_wallet': main_wallet, 'trigger': trigger, 'tx_signature': tx_signature,
           'policy': policy}
    await db.profit_splits.insert_one(dict(doc))
    from services import executor as _ex  # deferred: circulars

    injection = None
    try:
        from services import signer as _sg
        if _sg.executor_enabled():
            injection = await _ex.drain_reserve(f'rebuy:{trigger}')
    except Exception as e:
        log.warning('instant rebuy leg failed: %s', e)
    await add_event('TREASURER', f"PROFIT SPLIT ({trigger}): {total_sol:.4f} SOL → {main:.4f} main · {rebuy:.4f} rebuy reserve · {buf:.4f} buffer.", 'success')
    doc.pop('_id', None)
    return {**doc, 'rebuy_injection': injection}


async def history(limit: int = 50) -> list:
    return await db.profit_splits.find({}, {'_id': 0}).sort('created_at', -1).to_list(limit)
