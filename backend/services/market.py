import asyncio
import os
import time
import logging
from datetime import datetime, timezone
import httpx
from constants import TOKEN_MINT, GRADUATION_SOL

log = logging.getLogger('market')
WSOL = 'So11111111111111111111111111111111111111112'
COIN_IDS = {'XMR': 'monero', 'KAS': 'kaspa', 'BTC': 'bitcoin', 'LTC': 'litecoin', 'ETC': 'ethereum-classic', 'RVN': 'ravencoin'}
_cache: dict = {}


def _get(key, ttl):
    e = _cache.get(key)
    return e[1] if e and time.time() - e[0] < ttl else None


def _set(key, val):
    _cache[key] = (time.time(), val)
    return val


async def fetch_json(url, method='GET', json=None, timeout=12):
    async with httpx.AsyncClient(timeout=timeout, headers={'User-Agent': 'yabbai-forge/2.0'}) as c:
        r = await c.request(method, url, json=json)
        r.raise_for_status()
        return r.json()


async def get_dex():
    c = _get('dex', 20)
    if c is not None:
        return c
    try:
        j = await fetch_json(f'https://api.dexscreener.com/latest/dex/tokens/{TOKEN_MINT}')
        pairs = j.get('pairs') or []
        return _set('dex', pairs[0] if pairs else {})
    except Exception as e:
        log.warning('dexscreener failed: %s', e)
        return _cache.get('dex', (0, {}))[1]


async def get_pump():
    c = _get('pump', 20)
    if c is not None:
        return c
    try:
        j = await fetch_json(f'https://frontend-api-v3.pump.fun/coins/{TOKEN_MINT}')
        return _set('pump', j if isinstance(j, dict) and j.get('mint') else {})
    except Exception as e:
        log.warning('pump.fun failed: %s', e)
        return _cache.get('pump', (0, {}))[1]


async def get_sol_price():
    c = _get('sol', 60)
    if c:
        return c
    try:
        j = await fetch_json(f'https://lite-api.jup.ag/price/v3?ids={WSOL}')
        return _set('sol', {'usd': float(j[WSOL]['usdPrice']), 'source': 'jupiter'})
    except Exception as e:
        log.warning('jupiter failed: %s', e)
    d = await get_dex()
    if d.get('priceUsd') and d.get('priceNative'):
        return _set('sol', {'usd': float(d['priceUsd']) / float(d['priceNative']), 'source': 'dexscreener-derived'})
    return _cache.get('sol', (0, {'usd': 100.0, 'source': 'fallback'}))[1]


async def get_coin_price(symbol: str):
    key = f'coin:{symbol}'
    c = _get(key, 300)
    if c:
        return c
    cid = COIN_IDS.get(symbol)
    if not cid:
        return None
    try:
        j = await fetch_json(f'https://api.coingecko.com/api/v3/simple/price?ids={cid}&vs_currencies=usd')
        return _set(key, float(j[cid]['usd']))
    except Exception as e:
        log.warning('coingecko failed for %s: %s', symbol, e)
        return _cache.get(key, (0, None))[1]


def _ms_to_iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat() if ms else None


async def get_token_live():
    c = _get('token_live', 15)
    if c:
        return c
    pump, dex, sol = await get_pump(), await get_dex(), await get_sol_price()
    if not pump and not dex:
        last = _cache.get('token_live')
        if last:
            return last[1]
        raise RuntimeError('token data unavailable')
    sol_usd = sol['usd']
    vsol = int(pump.get('virtual_sol_reserves') or 0)
    vtok = int(pump.get('virtual_token_reserves') or 0)
    if vsol and vtok:
        price_sol = (vsol / 1e9) / (vtok / 1e6)
    else:
        price_sol = float(dex.get('priceNative') or 0)
    total_supply = int(pump.get('total_supply') or 1_000_000_000_000_000) / 1e6
    price_usd = price_sol * sol_usd
    mcap_sol = price_sol * total_supply
    real_sol = int(pump.get('real_sol_reserves') or 0) / 1e9
    ath_sol = float(pump.get('ath_market_cap') or 0)
    vol = (dex.get('volume') or {}) if dex else {}
    chg = (dex.get('priceChange') or {}) if dex else {}
    live = {
        'mint': TOKEN_MINT,
        'name': pump.get('name') or (dex.get('baseToken') or {}).get('name') or 'BASH AUTONOMOUS TERMINAL',
        'symbol': pump.get('symbol') or (dex.get('baseToken') or {}).get('symbol') or 'BASH',
        'description': pump.get('description') or '',
        'image_uri': pump.get('image_uri'),
        'creator': pump.get('creator'),
        'created_at': _ms_to_iso(pump.get('created_timestamp')),
        'complete': bool(pump.get('complete')),
        'price_sol': price_sol,
        'price_usd': price_usd,
        'market_cap_sol': mcap_sol,
        'market_cap_usd': float(pump.get('usd_market_cap') or mcap_sol * sol_usd),
        'ath_market_cap_sol': ath_sol,
        'ath_market_cap_usd': ath_sol * sol_usd,
        'virtual_sol_reserves': vsol,
        'virtual_token_reserves': vtok,
        'real_sol_reserves_sol': real_sol,
        'real_token_reserves': int(pump.get('real_token_reserves') or 0) / 1e6,
        'total_supply': total_supply,
        'curve_progress_pct': min(100.0, real_sol / GRADUATION_SOL * 100),
        'graduation_target_sol': GRADUATION_SOL,
        'sol_remaining_to_graduate': max(0.0, GRADUATION_SOL - real_sol),
        'volume_24h_usd': float(vol.get('h24') or 0),
        'volume_1h_usd': float(vol.get('h1') or 0),
        'price_change_24h_pct': float(chg.get('h24') or 0),
        'price_change_6h_pct': float(chg.get('h6') or 0),
        'last_trade_at': _ms_to_iso(pump.get('last_trade_timestamp')),
        'pair_address': pump.get('bonding_curve') or dex.get('pairAddress'),
        'pump_url': f'https://pump.fun/coin/{TOKEN_MINT}',
        'dex_url': f'https://dexscreener.com/solana/{TOKEN_MINT}',
        'solscan_url': f'https://solscan.io/token/{TOKEN_MINT}',
        'sol_price_usd': sol_usd,
        'sol_price_source': sol['source'],
        'sources': [s for s, ok in (('pump.fun', bool(pump)), ('dexscreener', bool(dex))) if ok],
        'fetched_at': datetime.now(timezone.utc).isoformat(),
    }
    return _set('token_live', live)


async def rpc(method: str, params: list):
    j = await fetch_json(os.environ['SOLANA_RPC_URL'], 'POST', {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params})
    if 'error' in j:
        raise RuntimeError(j['error'].get('message', 'rpc error'))
    return j['result']


async def get_wallet(address: str):
    key = f'wallet:{address}'
    c = _get(key, 20)
    if c:
        return c
    bal = await rpc('getBalance', [address])
    sigs = await rpc('getSignaturesForAddress', [address, {'limit': 6}])
    return _set(key, {
        'address': address,
        'balance_sol': bal['value'] / 1e9,
        'slot': bal['context']['slot'],
        'signatures': [{
            'signature': s['signature'], 'slot': s['slot'], 'block_time': s.get('blockTime'),
            'err': s.get('err'), 'memo': s.get('memo'), 'confirmation_status': s.get('confirmationStatus') or 'finalized',
        } for s in sigs],
        'solscan_url': f'https://solscan.io/account/{address}',
        'fetched_at': datetime.now(timezone.utc).isoformat(),
    })


async def verify_signature(signature: str):
    res = await rpc('getSignatureStatuses', [[signature], {'searchTransactionHistory': True}])
    val = (res.get('value') or [None])[0]
    if not val:
        return {'valid': False, 'status': None}
    return {'valid': True, 'status': val.get('confirmationStatus') or 'confirmed', 'slot': val.get('slot'), 'err': val.get('err')}


async def get_transaction(signature: str):
    return await rpc('getTransaction', [signature, {'encoding': 'jsonParsed', 'maxSupportedTransactionVersion': 0, 'commitment': 'confirmed'}])


async def fetch_tx_retry(signature: str, attempts: int = 8, delay: float = 2.5):
    for _ in range(attempts):
        try:
            tx = await get_transaction(signature)
        except RuntimeError as e:
            if 'Invalid param' in str(e):
                raise ValueError('malformed signature')
            log.warning('getTransaction failed: %s', e)
            tx = None
        if tx:
            return tx
        await asyncio.sleep(delay)
    return None


def sol_received_by(tx: dict, address: str):
    keys = [k['pubkey'] if isinstance(k, dict) else k for k in tx['transaction']['message']['accountKeys']]
    if address not in keys:
        return None
    i = keys.index(address)
    return (tx['meta']['postBalances'][i] - tx['meta']['preBalances'][i]) / 1e9


def token_delta_for(tx: dict, owner: str, mint: str) -> float:
    def total(rows):
        return sum(float((r.get('uiTokenAmount') or {}).get('uiAmount') or 0) for r in rows or [] if r.get('mint') == mint and r.get('owner') == owner)
    return total(tx['meta'].get('postTokenBalances')) - total(tx['meta'].get('preTokenBalances'))


async def get_token_balance(owner: str, mint: str) -> float:
    key = f'tokbal:{owner}:{mint}'
    c = _get(key, 20)
    if c is not None:
        return c
    res = await rpc('getTokenAccountsByOwner', [owner, {'mint': mint}, {'encoding': 'jsonParsed'}])
    total = 0.0
    for acc in res.get('value', []):
        total += float(acc['account']['data']['parsed']['info']['tokenAmount'].get('uiAmount') or 0)
    return _set(key, total)


def invalidate(*keys):
    for k in keys:
        _cache.pop(k, None)


JUP_SWAP = 'https://lite-api.jup.ag/swap/v1'


async def jup_quote(amount_lamports: int, slippage_bps: int):
    return await fetch_json(f'{JUP_SWAP}/quote?inputMint={WSOL}&outputMint={TOKEN_MINT}&amount={amount_lamports}&slippageBps={slippage_bps}&restrictIntermediateTokens=true', timeout=20)


async def jup_swap(quote: dict, user_pubkey: str):
    body = {'quoteResponse': quote, 'userPublicKey': user_pubkey, 'wrapAndUnwrapSol': True, 'dynamicComputeUnitLimit': True,
            'prioritizationFeeLamports': {'priorityLevelWithMaxLamports': {'priorityLevel': 'high', 'maxLamports': 1_000_000}}}
    return await fetch_json(f'{JUP_SWAP}/swap', 'POST', body, timeout=25)
