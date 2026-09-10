import logging
from datetime import datetime, timedelta, timezone
from db import db
from constants import GRADUATION_SOL, SOL_RECIPIENT
from services import market, telegram
from services.events import add_event
from services.util import utcnow, iso, parse, new_id

log = logging.getLogger('flywheel')
MODE = 'LIVE_DIRECTOR_SIGNED'

DEFAULT_CONFIG = {
    'buyback_pct': 0.15,
    'window_min': 60,
    'hourly_capacity_sol': 0.25,
    'min_injection_sol': 0.005,
    'signer_wallet': SOL_RECIPIENT,
    'min_wallet_balance_sol': 0.05,
    'max_slippage_bps': 300,
    'mining_share_pct': 1.0,
    'mining_hashrates': {},
}
CONFIG_KEYS = set(DEFAULT_CONFIG)

ZERO_STATE = {
    'buyback_reserve_sol': 0.0, 'total_allocated_sol': 0.0, 'total_mining_sol': 0.0, 'total_injected_sol': 0.0, 'total_tokens_acquired': 0.0,
    'window_injected_sol': 0.0, 'injections_count': 0, 'delays_count': 0,
    'last_injection_at': None, 'last_delay_resumes_at': None,
}


def _window_start(now: datetime, interval_min: int) -> datetime:
    sec = interval_min * 60
    epoch = int(now.timestamp()) // sec * sec
    return datetime.fromtimestamp(epoch, tz=timezone.utc)


async def get_config():
    doc = await db.flywheel_config.find_one({'key': 'config'}, {'_id': 0}) or {}
    return {**DEFAULT_CONFIG, **{k: v for k, v in doc.items() if k in CONFIG_KEYS}}


async def update_config(patch: dict):
    await db.flywheel_config.update_one({'key': 'config'}, {'$set': patch}, upsert=True)
    return await get_config()


async def get_state():
    doc = await db.flywheel_state.find_one({'key': 'state'}, {'_id': 0})
    if not doc:
        cfg = await get_config()
        doc = {'key': 'state', **ZERO_STATE, 'window_start': iso(_window_start(utcnow(), cfg['window_min']))}
        await db.flywheel_state.insert_one(dict(doc))
    return {**ZERO_STATE, **doc}


async def save_state(st: dict):
    await db.flywheel_state.update_one({'key': 'state'}, {'$set': st}, upsert=True)


async def get_pending_intent():
    return await db.buyback_intents.find_one({'status': 'awaiting_signature'}, {'_id': 0}, sort=[('created_at', -1)])


async def create_or_refresh_intent(amount_sol: float, trigger: str, expires_at):
    now = utcnow()
    existing = await get_pending_intent()
    if existing:
        patch = {'amount_sol': amount_sol, 'trigger': trigger, 'updated_at': iso(now), 'expires_at': iso(expires_at)}
        await db.buyback_intents.update_one({'id': existing['id']}, {'$set': patch})
        return {**existing, **patch}, False
    intent = {'id': new_id('bb-'), 'status': 'awaiting_signature', 'amount_sol': amount_sol, 'trigger': trigger,
              'created_at': iso(now), 'updated_at': iso(now), 'expires_at': iso(expires_at)}
    await db.buyback_intents.insert_one(dict(intent))
    return intent, True


async def dismiss_pending_intents(reason: str):
    res = await db.buyback_intents.update_many({'status': 'awaiting_signature'}, {'$set': {'status': 'dismissed', 'dismissed_reason': reason, 'updated_at': iso(utcnow())}})
    return res.modified_count


async def ledger_add(kind: str, **fields):
    doc = {'id': new_id('fl-'), 'type': kind, 'created_at': iso(utcnow()), **fields}
    await db.flywheel_ledger.insert_one(dict(doc))
    return doc


async def allocate_from_payment(payment: dict):
    cfg, st = await get_config(), await get_state()
    sol = float(payment['sol_amount']) * cfg['buyback_pct']
    st['buyback_reserve_sol'] += sol
    st['total_allocated_sol'] += sol
    entry = await ledger_add('allocation', amount_sol=sol, amount_usd=payment['amount_usd'] * cfg['buyback_pct'], reserve_after=st['buyback_reserve_sol'],
                             source='purchase', payment_id=payment['id'], biz=payment['biz'], package=payment['package'], pct=cfg['buyback_pct'],
                             tx_signature=payment.get('tx_signature'), sol_price_usd=payment.get('sol_price_usd'))
    await save_state(st)
    await add_event('TREASURER', f"FLYWHEEL ALLOCATION: {cfg['buyback_pct'] * 100:.0f}% of {payment['sol_amount']:.4f} SOL received from {payment['biz']} "
                                 f"→ {sol:.4f} SOL earmarked for $BASH buybacks (tx {str(payment.get('tx_signature', ''))[:10]}…).", 'success')
    injection = await try_inject('purchase')
    return {'allocation': entry, 'injection': injection}


def roll_window(st, cfg, now: datetime) -> bool:
    ws = _window_start(now, cfg['window_min'])
    if parse(st['window_start']) < ws:
        st['window_start'] = iso(ws)
        st['window_injected_sol'] = 0.0
        return True
    return False


async def try_inject(trigger: str):
    cfg, st = await get_config(), await get_state()
    now = utcnow()
    roll_window(st, cfg, now)
    reserve = st['buyback_reserve_sol']
    resumes = parse(st['window_start']) + timedelta(minutes=cfg['window_min'])
    if reserve < cfg['min_injection_sol']:
        await save_state(st)
        return {'status': 'below_min', 'reserve_sol': reserve, 'min_injection_sol': cfg['min_injection_sol']}
    cap_left = max(0.0, cfg['hourly_capacity_sol'] - st['window_injected_sol'])
    if cap_left <= 1e-12:
        st['delays_count'] += 1
        st['last_delay_resumes_at'] = iso(resumes)
        await save_state(st)
        entry = await ledger_add('delayed', amount_sol=reserve, reason='capacity_reached', trigger=trigger, resumes_at=iso(resumes), cap_sol=cfg['hourly_capacity_sol'])
        await add_event('INJECTOR', f"CAPACITY GOVERNOR: {cfg['hourly_capacity_sol']} SOL/window cap reached. "
                                    f"{reserve:.4f} SOL buyback delayed until {resumes:%H:%M} UTC ({trigger}).", 'gate')
        telegram.fire('delayed', telegram.delay_text(entry))
        return {'status': 'delayed', **entry}
    amt = min(reserve, cap_left)
    await save_state(st)
    intent, created = await create_or_refresh_intent(amt, trigger, resumes)
    if created:
        await add_event('INJECTOR', f"BUYBACK READY: governor released {amt:.4f} SOL ({trigger}). Awaiting Director signature from the treasury wallet.", 'gate')
        telegram.fire('intent', telegram.intent_text(intent))
    return {'status': 'awaiting_signature', **intent}


async def tick(now: datetime):
    cfg, st = await get_config(), await get_state()
    rolled = roll_window(st, cfg, now)
    await save_state(st)
    if rolled and st['buyback_reserve_sol'] >= cfg['min_injection_sol']:
        await try_inject('window_resume')


async def status():
    cfg, st = await get_config(), await get_state()
    now = utcnow()
    try:
        live = await market.get_token_live()
    except Exception as e:
        log.warning('token live unavailable: %s', e)
        live = None
    sol_price = live['sol_price_usd'] if live else (await market.get_sol_price())['usd']
    interval = timedelta(minutes=cfg['window_min'])
    ws = _window_start(now, cfg['window_min'])
    window_injected = st['window_injected_sol'] if parse(st['window_start']) >= ws else 0.0
    window_end = ws + interval
    cap = cfg['hourly_capacity_sol']
    position_value_sol = st['total_tokens_acquired'] * (live['price_sol'] if live else 0)
    return {
        'config': cfg,
        'state': st,
        'mode': MODE,
        'live': {'mode': MODE, 'signer_wallet': cfg['signer_wallet'], 'pending_intent': await get_pending_intent()},
        'derived': {
            'now': iso(now),
            'sol_price_usd': sol_price,
            'reserve_usd': st['buyback_reserve_sol'] * sol_price,
            'window_start': iso(ws),
            'window_end': iso(window_end),
            'seconds_to_window_end': max(0, int((window_end - now).total_seconds())),
            'window_injected_sol': window_injected,
            'window_cap_left_sol': max(0.0, cap - window_injected),
            'window_usage_pct': min(100.0, window_injected / cap * 100) if cap else 100.0,
            'governor_active': st['buyback_reserve_sol'] >= cfg['min_injection_sol'] and window_injected >= cap - 1e-12,
            'total_inflow_sol': st['total_allocated_sol'] + st.get('total_mining_sol', 0.0),
            'total_injected_usd': st['total_injected_sol'] * sol_price,
            'position_value_sol': position_value_sol,
            'position_value_usd': position_value_sol * sol_price,
            'position_supply_pct': (st['total_tokens_acquired'] / live['total_supply'] * 100) if live else 0,
            'live_curve_progress_pct': live['curve_progress_pct'] if live else 0,
            'treasury_curve_contribution_pct': min(100.0, st['total_injected_sol'] / GRADUATION_SOL * 100),
            'graduation_target_sol': GRADUATION_SOL,
        },
        'token': live,
    }
