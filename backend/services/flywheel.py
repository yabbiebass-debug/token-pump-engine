import logging
from datetime import datetime, timedelta, timezone
from db import db
from constants import GRADUATION_SOL, PUMP_FEE
from services import market
from services.events import add_event
from services.util import utcnow, iso, parse, new_id

log = logging.getLogger('flywheel')

DEFAULT_CONFIG = {
    'mode': 'SIMULATED',
    'buyback_pct': 0.15,
    'stage_tap_pct': 0.0025,
    'hashrate_khs': 250.0,
    'mined_symbol': 'XMR',
    'mined_price_usd': 165.0,
    'yield_per_khs_hour': 0.0000045,
    'conversion_interval_min': 60,
    'hourly_capacity_sol': 0.25,
    'min_injection_sol': 0.005,
}

ZERO_STATE = {
    'buyback_reserve_sol': 0.0, 'mined_balance': 0.0, 'total_mined': 0.0,
    'total_allocated_sol': 0.0, 'total_tapped_sol': 0.0, 'total_converted_sol': 0.0,
    'total_injected_sol': 0.0, 'total_tokens_acquired': 0.0,
    'window_injected_sol': 0.0, 'injections_count': 0, 'delays_count': 0,
    'conversions_count': 0, 'fast_forwards': 0,
    'last_injection_at': None, 'last_delay_resumes_at': None,
    'sim_virtual_sol': None, 'sim_virtual_tokens': None,
}


def _window_start(now: datetime, interval_min: int) -> datetime:
    sec = interval_min * 60
    epoch = int(now.timestamp()) // sec * sec
    return datetime.fromtimestamp(epoch, tz=timezone.utc)


async def get_config():
    doc = await db.flywheel_config.find_one({'key': 'config'}, {'_id': 0})
    if not doc:
        doc = {'key': 'config', **DEFAULT_CONFIG}
        await db.flywheel_config.insert_one(dict(doc))
    return doc


async def update_config(patch: dict):
    await db.flywheel_config.update_one({'key': 'config'}, {'$set': patch}, upsert=True)
    return await get_config()


async def get_state():
    doc = await db.flywheel_state.find_one({'key': 'state'}, {'_id': 0})
    if not doc:
        n = utcnow()
        cfg = await get_config()
        doc = {'key': 'state', **ZERO_STATE, 'last_accrual_at': iso(n), 'last_conversion_at': iso(n),
               'window_start': iso(_window_start(n, cfg['conversion_interval_min']))}
        await db.flywheel_state.insert_one(dict(doc))
    return doc


async def save_state(st: dict):
    await db.flywheel_state.update_one({'key': 'state'}, {'$set': st}, upsert=True)


async def ledger_add(kind: str, **fields):
    doc = {'id': new_id('fl-'), 'type': kind, 'created_at': iso(utcnow()), **fields}
    await db.flywheel_ledger.insert_one(dict(doc))
    return doc


async def _credit(st, sol, kind, **fields):
    st['buyback_reserve_sol'] += sol
    return await ledger_add(kind, amount_sol=sol, reserve_after=st['buyback_reserve_sol'], **fields)


async def allocate_from_payment(payment: dict):
    cfg, st = await get_config(), await get_state()
    sol_price = (await market.get_sol_price())['usd']
    usd = payment['amount_usd'] * cfg['buyback_pct']
    sol = usd / sol_price
    entry = await _credit(st, sol, 'allocation', source='purchase', payment_id=payment['id'], biz=payment['biz'],
                          package=payment['package'], amount_usd=usd, pct=cfg['buyback_pct'], sol_price_usd=sol_price)
    st['total_allocated_sol'] += sol
    await save_state(st)
    await add_event('TREASURER', f"FLYWHEEL ALLOCATION: {cfg['buyback_pct'] * 100:.0f}% of ${payment['amount_usd']:,.0f} "
                                 f"({payment['biz']}) → {sol:.4f} SOL credited to the $BASH buyback reserve.", 'success')
    injection = await try_inject('purchase')
    return {'allocation': entry, 'injection': injection}


async def stage_tap(st, cfg, stage: str, cycle_n: int, total_mrr: float, sol_price: float):
    usd = total_mrr * cfg['stage_tap_pct']
    sol = usd / sol_price
    st['total_tapped_sol'] += sol
    return await _credit(st, sol, 'stage_tap', stage=stage, cycle_n=cycle_n, amount_usd=usd, sol_price_usd=sol_price)


def accrue(st, cfg, now: datetime) -> float:
    hours = max(0.0, (now - parse(st['last_accrual_at'])).total_seconds() / 3600)
    mined = cfg['hashrate_khs'] * cfg['yield_per_khs_hour'] * hours
    st['mined_balance'] += mined
    st['total_mined'] += mined
    st['last_accrual_at'] = iso(now)
    return mined


async def mined_price(cfg):
    p = await market.get_coin_price(cfg['mined_symbol'])
    return (p, 'coingecko') if p else (cfg['mined_price_usd'], 'config')


async def convert_mined(st, cfg, now: datetime, trigger: str):
    price, src = await mined_price(cfg)
    sol_price = (await market.get_sol_price())['usd']
    amt = st['mined_balance']
    usd = amt * price
    sol = usd / sol_price
    st['mined_balance'] = 0.0
    st['last_conversion_at'] = iso(now)
    st['total_converted_sol'] += sol
    st['conversions_count'] += 1
    entry = await _credit(st, sol, 'conversion', mined_amount=amt, mined_symbol=cfg['mined_symbol'], mined_price_usd=price,
                          price_source=src, amount_usd=usd, sol_price_usd=sol_price, trigger=trigger)
    await add_event('TREASURER', f"HOURLY CONVERSION: {amt:.6f} {cfg['mined_symbol']} mined → ${usd:.2f} → {sol:.6f} SOL swept into the buyback reserve ({trigger}).")
    return entry


def roll_window(st, cfg, now: datetime) -> bool:
    ws = _window_start(now, cfg['conversion_interval_min'])
    if parse(st['window_start']) < ws:
        st['window_start'] = iso(ws)
        st['window_injected_sol'] = 0.0
        return True
    return False


def _curve_buy(vsol: float, vtok: float, sol_in: float):
    lamports = sol_in * (1 - PUMP_FEE) * 1e9
    k = vsol * vtok
    new_vsol = vsol + lamports
    new_vtok = k / new_vsol
    tokens = (vtok - new_vtok) / 1e6
    price_before = (vsol / 1e9) / (vtok / 1e6)
    price_after = (new_vsol / 1e9) / (new_vtok / 1e6)
    return new_vsol, new_vtok, tokens, price_before, price_after


async def try_inject(trigger: str):
    cfg, st = await get_config(), await get_state()
    now = utcnow()
    roll_window(st, cfg, now)
    reserve = st['buyback_reserve_sol']
    resumes = parse(st['window_start']) + timedelta(minutes=cfg['conversion_interval_min'])
    if reserve < cfg['min_injection_sol']:
        await save_state(st)
        return {'status': 'below_min', 'reserve_sol': reserve, 'min_injection_sol': cfg['min_injection_sol']}
    cap_left = max(0.0, cfg['hourly_capacity_sol'] - st['window_injected_sol'])
    if cap_left <= 1e-12:
        st['delays_count'] += 1
        st['last_delay_resumes_at'] = iso(resumes)
        await save_state(st)
        entry = await ledger_add('delayed', amount_sol=reserve, reason='capacity_reached', trigger=trigger,
                                 resumes_at=iso(resumes), cap_sol=cfg['hourly_capacity_sol'])
        await add_event('INJECTOR', f"CAPACITY GOVERNOR: {cfg['hourly_capacity_sol']} SOL/window cap reached. "
                                    f"{reserve:.4f} SOL injection delayed until {resumes:%H:%M} UTC ({trigger}).", 'gate')
        return {'status': 'delayed', **entry}
    live = await market.get_token_live()
    vsol = st.get('sim_virtual_sol') or live['virtual_sol_reserves']
    vtok = st.get('sim_virtual_tokens') or live['virtual_token_reserves']
    amt = min(reserve, cap_left)
    new_vsol, new_vtok, tokens, p_before, p_after = _curve_buy(vsol, vtok, amt)
    impact = (p_after / p_before - 1) * 100 if p_before else 0
    st.update({'sim_virtual_sol': new_vsol, 'sim_virtual_tokens': new_vtok})
    st['buyback_reserve_sol'] -= amt
    st['window_injected_sol'] += amt
    st['total_injected_sol'] += amt
    st['total_tokens_acquired'] += tokens
    st['injections_count'] += 1
    st['last_injection_at'] = iso(now)
    progress = min(100.0, (live['real_sol_reserves_sol'] + st['total_injected_sol']) / GRADUATION_SOL * 100)
    entry = await ledger_add('injection', amount_sol=amt, amount_usd=amt * live['sol_price_usd'], tokens_acquired=tokens,
                             avg_price_sol=amt / tokens if tokens else 0, price_before_sol=p_before, price_after_sol=p_after,
                             impact_pct=impact, trigger=trigger, mode=cfg['mode'], curve_progress_after_pct=progress,
                             sol_price_usd=live['sol_price_usd'], reserve_after=st['buyback_reserve_sol'])
    await add_event('INJECTOR', f"BUYBACK INJECTION [{cfg['mode']}]: {amt:.4f} SOL → {tokens:,.0f} $BASH on the bonding curve "
                                f"(+{impact:.2f}% price · curve {progress:.2f}% to graduation) · trigger: {trigger}.", 'success')
    remainder = st['buyback_reserve_sol']
    if remainder >= cfg['min_injection_sol'] and st['window_injected_sol'] >= cfg['hourly_capacity_sol'] - 1e-12:
        st['delays_count'] += 1
        st['last_delay_resumes_at'] = iso(resumes)
        await ledger_add('delayed', amount_sol=remainder, reason='capacity_reached', trigger=trigger,
                         resumes_at=iso(resumes), cap_sol=cfg['hourly_capacity_sol'])
        await add_event('INJECTOR', f"CAPACITY GOVERNOR: cap hit after injection. {remainder:.4f} SOL held in reserve until {resumes:%H:%M} UTC.", 'gate')
    await save_state(st)
    return {'status': 'injected', **entry}


async def hourly_job(now: datetime = None):
    now = now or utcnow()
    cfg, st = await get_config(), await get_state()
    accrue(st, cfg, now)
    conv = await convert_mined(st, cfg, now, 'scheduled')
    await save_state(st)
    return {'conversion': conv, 'injection': await try_inject('hourly_conversion')}


async def fast_forward_hour():
    cfg, st = await get_config(), await get_state()
    now = utcnow()
    st['last_accrual_at'] = iso(parse(st['last_accrual_at']) - timedelta(hours=1))
    accrue(st, cfg, now)
    conv = await convert_mined(st, cfg, now, 'fast_forward')
    st['window_injected_sol'] = 0.0
    st['fast_forwards'] += 1
    await save_state(st)
    await add_event('INJECTOR', 'FAST-FORWARD: simulated one hour of hashing; conversion + new governor window opened.')
    return {'conversion': conv, 'injection': await try_inject('fast_forward')}


async def tick(now: datetime):
    cfg, st = await get_config(), await get_state()
    accrue(st, cfg, now)
    rolled = roll_window(st, cfg, now)
    await save_state(st)
    due = now - parse(st['last_conversion_at']) >= timedelta(minutes=cfg['conversion_interval_min'])
    if due:
        await hourly_job(now)
    elif rolled and st['buyback_reserve_sol'] >= cfg['min_injection_sol']:
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
    price, src = await mined_price(cfg)
    interval = timedelta(minutes=cfg['conversion_interval_min'])
    pending_hours = (now - parse(st['last_accrual_at'])).total_seconds() / 3600
    mined_live = st['mined_balance'] + cfg['hashrate_khs'] * cfg['yield_per_khs_hour'] * pending_hours
    next_conv = parse(st['last_conversion_at']) + interval
    ws = _window_start(now, cfg['conversion_interval_min'])
    window_injected = st['window_injected_sol'] if parse(st['window_start']) >= ws else 0.0
    window_end = ws + interval
    total_in = st['total_allocated_sol'] + st['total_tapped_sol'] + st['total_converted_sol']
    sim_real = (live['real_sol_reserves_sol'] if live else 0) + st['total_injected_sol']
    position_value_sol = st['total_tokens_acquired'] * (live['price_sol'] if live else 0)
    return {
        'config': cfg,
        'state': st,
        'derived': {
            'now': iso(now),
            'sol_price_usd': sol_price,
            'mined_price_usd': price,
            'mined_price_source': src,
            'mined_balance_live': mined_live,
            'mined_balance_usd': mined_live * price,
            'mined_per_hour': cfg['hashrate_khs'] * cfg['yield_per_khs_hour'],
            'mined_per_hour_usd': cfg['hashrate_khs'] * cfg['yield_per_khs_hour'] * price,
            'mined_per_hour_sol': cfg['hashrate_khs'] * cfg['yield_per_khs_hour'] * price / sol_price,
            'reserve_usd': st['buyback_reserve_sol'] * sol_price,
            'next_conversion_at': iso(next_conv),
            'seconds_to_next_conversion': max(0, int((next_conv - now).total_seconds())),
            'window_start': iso(ws),
            'window_end': iso(window_end),
            'window_injected_sol': window_injected,
            'window_cap_left_sol': max(0.0, cfg['hourly_capacity_sol'] - window_injected),
            'window_usage_pct': min(100.0, window_injected / cfg['hourly_capacity_sol'] * 100) if cfg['hourly_capacity_sol'] else 100.0,
            'governor_active': st['buyback_reserve_sol'] >= cfg['min_injection_sol'] and window_injected >= cfg['hourly_capacity_sol'] - 1e-12,
            'total_inflow_sol': total_in,
            'total_injected_usd': st['total_injected_sol'] * sol_price,
            'position_value_sol': position_value_sol,
            'position_value_usd': position_value_sol * sol_price,
            'position_supply_pct': (st['total_tokens_acquired'] / live['total_supply'] * 100) if live else 0,
            'live_curve_progress_pct': live['curve_progress_pct'] if live else 0,
            'projected_curve_progress_pct': min(100.0, sim_real / GRADUATION_SOL * 100),
            'projected_real_sol': sim_real,
            'graduation_target_sol': GRADUATION_SOL,
        },
        'token': live,
    }
