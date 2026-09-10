import logging
import time
from db import db
from constants import SOL_RECIPIENT
from services import flywheel, market, treasury
from services.events import add_event
from services.util import utcnow, iso

log = logging.getLogger('mining')
UNM = 'https://api.unminable.com/v4'
POOL_FEE = 0.01
UNIT_MULT = {'H/s': 1, 'kH/s': 1e3, 'MH/s': 1e6, 'GH/s': 1e9}
ALGOS = {
    'randomx': {'label': 'RandomX', 'hw': 'CPU', 'coin': 'XMR', 'wtm_id': 101, 'unit': 'kH/s', 'pool': 'rx.unmineable.com:3333', 'miner': 'xmrig',
                'cmd': 'xmrig -o rx.unmineable.com:3333 -a rx -k -u SOL:{addr}.{worker} -p x'},
    'kawpow': {'label': 'KawPow', 'hw': 'GPU', 'coin': 'RVN', 'wtm_id': 234, 'unit': 'MH/s', 'pool': 'kp.unmineable.com:3333', 'miner': 'lolMiner',
               'cmd': 'lolMiner --algo KAWPOW --pool kp.unmineable.com:3333 --user SOL:{addr}.{worker}'},
    'etchash': {'label': 'Etchash', 'hw': 'GPU', 'coin': 'ETC', 'wtm_id': 162, 'unit': 'MH/s', 'pool': 'etchash.unmineable.com:3333', 'miner': 'lolMiner',
                'cmd': 'lolMiner --algo ETCHASH --pool etchash.unmineable.com:3333 --user SOL:{addr}.{worker} --ethstratum ETHPROXY'},
    'autolykos': {'label': 'Autolykos2', 'hw': 'GPU', 'coin': 'ERG', 'wtm_id': 340, 'unit': 'MH/s', 'pool': 'autolykos.unmineable.com:3333', 'miner': 'lolMiner',
                  'cmd': 'lolMiner --algo AUTOLYKOS2 --pool autolykos.unmineable.com:3333 --user SOL:{addr}.{worker}'},
    'kheavyhash': {'label': 'kHeavyHash', 'hw': 'GPU / ASIC', 'coin': 'KAS', 'wtm_id': 352, 'unit': 'GH/s', 'pool': 'kheavyhash.unmineable.com:4444 (SSL)', 'miner': 'lolMiner',
                   'cmd': 'lolMiner --algo KASPA --pool stratum+ssl://kheavyhash.unmineable.com:4444 --user SOL:{addr}.{worker}'},
}
_last_sync = 0.0


async def _unm(path: str, ttl: int = 45):
    key = f'unm:{path}'
    c = market._get(key, ttl)
    if c is not None:
        return c
    try:
        j = await market.fetch_json(f'{UNM}/{path}', timeout=15)
        return market._set(key, j.get('data') if isinstance(j, dict) else None)
    except Exception as e:
        log.warning('unmineable %s failed: %s', path, e)
        return market._cache.get(key, (0, None))[1]


async def account():
    return await _unm(f'address/{SOL_RECIPIENT}?coin=SOL')


async def _wtm(coin_id: int):
    key = f'wtm:{coin_id}'
    c = market._get(key, 600)
    if c:
        return c
    try:
        return market._set(key, await market.fetch_json(f'https://whattomine.com/coins/{coin_id}.json', timeout=15))
    except Exception as e:
        log.warning('whattomine %s failed: %s', coin_id, e)
        return market._cache.get(key, (0, None))[1]


def _flatten_workers(raw: dict):
    out = []
    for algo, blk in (raw or {}).items():
        for w in (blk or {}).get('workers') or []:
            out.append({'algo': algo, 'name': w.get('name'), 'online': bool(w.get('online')), 'reported_hs': float(w.get('rhr') or 0), 'calculated_hs': float(w.get('chr') or 0),
                        'last_seen': w.get('last'), 'referral': w.get('referral')})
    return out


def _estimate(algo: str, hashrate_units: float, btc_usd: float, sol_usd: float, wtm: dict):
    a = ALGOS[algo]
    hs = float(hashrate_units or 0) * UNIT_MULT[a['unit']]
    nethash = float(wtm.get('nethash') or 0)
    block_time = float(wtm.get('block_time') or 0)
    reward = float(wtm.get('block_reward24') or wtm.get('block_reward') or 0)
    rate_btc = float(wtm.get('exchange_rate') or 0)
    if not (nethash and block_time):
        return None
    coins_day = (hs / nethash) * (86400 / block_time) * reward
    usd_day = coins_day * rate_btc * btc_usd * (1 - POOL_FEE)
    per_unit_usd = ((UNIT_MULT[a['unit']] / nethash) * (86400 / block_time) * reward) * rate_btc * btc_usd * (1 - POOL_FEE)
    return {'algo': algo, 'label': a['label'], 'hw': a['hw'], 'coin': a['coin'], 'unit': a['unit'], 'hashrate': float(hashrate_units or 0),
            'coins_day': coins_day, 'usd_day': usd_day, 'sol_day': usd_day / sol_usd if sol_usd else 0, 'sol_month': (usd_day / sol_usd * 30) if sol_usd else 0,
            'per_unit_usd_day': per_unit_usd, 'per_unit_sol_day': per_unit_usd / sol_usd if sol_usd else 0,
            'coin_price_usd': rate_btc * btc_usd, 'nethash': nethash, 'pool': a['pool'], 'miner': a['miner'], 'command': a['cmd'],
            'source': f"whattomine #{a['wtm_id']}"}


async def profitability(hashrates: dict):
    btc = await market.get_coin_price('BTC') or 0.0
    sol_usd = (await market.get_sol_price())['usd']
    rows = []
    for algo in ALGOS:
        wtm = await _wtm(ALGOS[algo]['wtm_id'])
        if not wtm:
            continue
        est = _estimate(algo, (hashrates or {}).get(algo, 0), btc, sol_usd, wtm)
        if est:
            rows.append(est)
    rows.sort(key=lambda r: (r['usd_day'], r['per_unit_usd_day']), reverse=True)
    return {'btc_usd': btc, 'sol_usd': sol_usd, 'pool_fee_pct': POOL_FEE * 100, 'rows': rows}


async def allocate_from_payout(activity: dict):
    cfg, st = await flywheel.get_config(), await flywheel.get_state()
    share = float(cfg.get('mining_share_pct', 1.0))
    amount = float(activity['sol_delta'])
    sol = amount * share
    sol_price = (await market.get_sol_price())['usd']
    st['buyback_reserve_sol'] += sol
    st['total_mining_sol'] = st.get('total_mining_sol', 0.0) + sol
    entry = await flywheel.ledger_add('allocation', amount_sol=sol, amount_usd=sol * sol_price, reserve_after=st['buyback_reserve_sol'], source='mining',
                                      pool='unmineable', payout_sol=amount, pct=share, tx_signature=activity['signature'], sol_price_usd=sol_price)
    await flywheel.save_state(st)
    await db.treasury_activity.update_one({'signature': activity['signature']}, {'$set': {'allocated': True, 'ledger_id': entry['id']}})
    await add_event('TREASURER', f"MINING PAYOUT: {amount:.4f} SOL landed from unMineable (tx {activity['signature'][:10]}…) → {share * 100:.0f}% = {sol:.4f} SOL earmarked for $BASH buybacks.", 'success')
    injection = await flywheel.try_inject('mining_payout')
    return {'allocation': entry, 'injection': injection}


async def sync():
    global _last_sync
    acct = await account()
    if not acct or not acct.get('uuid'):
        return []
    pays = await _unm(f"account/{acct['uuid']}/payments?page=1", ttl=60)
    processed = []
    for p in (pays or {}).get('list') or []:
        sig = p.get('tx') or p.get('txid') or p.get('hash') or p.get('transaction')
        if not sig or not isinstance(sig, str) or len(sig) < 64:
            continue
        doc = await treasury.index_signature(sig)
        if not doc or doc.get('sol_delta', 0) <= 0:
            continue
        patch = {'kind': 'mining_payout', 'source': 'unmineable', 'pool_amount': p.get('amount')}
        if doc.get('kind') != 'mining_payout':
            await db.treasury_activity.update_one({'signature': sig}, {'$set': patch})
            doc.update(patch)
        if not doc.get('allocated'):
            processed.append(await allocate_from_payout(doc))
    _last_sync = time.time()
    return processed


async def sync_if_stale(max_age: float = 60):
    if time.time() - _last_sync < max_age:
        return []
    try:
        return await sync()
    except Exception as e:
        log.warning('mining sync failed: %s', e)
        return []


async def status():
    cfg = await flywheel.get_config()
    acct = await account()
    uuid = (acct or {}).get('uuid')
    stats = await _unm(f'account/{uuid}/stats') if uuid else None
    workers = _flatten_workers(await _unm(f'account/{uuid}/workers')) if uuid else []
    pays = (await _unm(f'account/{uuid}/payments?page=1', ttl=60)) if uuid else None
    sol_usd = (await market.get_sol_price())['usd']
    payouts = await db.treasury_activity.find({'kind': 'mining_payout'}, {'_id': 0}).sort('block_time', -1).to_list(50)
    ledger = await db.flywheel_ledger.find({'type': 'allocation', 'source': 'mining'}, {'_id': 0, 'amount_sol': 1}).to_list(5000)
    threshold = float((acct or {}).get('payment_threshold') or 0.05)
    pending = float((acct or {}).get('balance') or 0)
    online = [w for w in workers if w['online']]
    return {
        'pool': 'unMineable', 'payout_coin': 'SOL', 'address': SOL_RECIPIENT, 'ok': bool(acct), 'uuid': uuid,
        'dashboard_url': f'https://unmineable.com/coins/SOL/address/{SOL_RECIPIENT}',
        'pending_sol': pending, 'pending_usd': pending * sol_usd, 'payable_sol': float((acct or {}).get('balance_payable') or 0),
        'payment_threshold_sol': threshold, 'threshold_pct': min(100.0, pending / threshold * 100) if threshold else 0, 'pool_fee_pct': float((acct or {}).get('mining_fee') or 1),
        'auto_pay': bool((acct or {}).get('auto')), 'fresh': bool((acct or {}).get('fresh', True)),
        'rewarded': (stats or {}).get('rewarded') or {'past_24h': '0', 'past_7d': '0', 'past_30d': '0'}, 'paid_total_sol': float((stats or {}).get('paid') or 0),
        'last_payment': (stats or {}).get('last_payment'),
        'workers': workers, 'workers_online': len(online), 'hashrate_by_algo': {a: sum(w['calculated_hs'] or w['reported_hs'] for w in online if w['algo'] == a) for a in {w['algo'] for w in online}},
        'pool_payments': (pays or {}).get('list') or [], 'payouts_onchain': payouts, 'payouts_total_sol': sum(p['sol_delta'] for p in payouts),
        'allocated_total_sol': sum(x['amount_sol'] for x in ledger), 'share_pct': float(cfg.get('mining_share_pct', 1.0)), 'hashrates': cfg.get('mining_hashrates') or {},
        'algos': {k: {kk: v[kk] for kk in ('label', 'hw', 'coin', 'unit', 'pool', 'miner', 'cmd')} for k, v in ALGOS.items()}, 'sol_usd': sol_usd,
    }
