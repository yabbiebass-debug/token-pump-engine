import asyncio
import logging
import time
from datetime import timedelta
from db import db
from services import flywheel, market
from services.cycle import run_cycle
from services.events import get_app_state
from services.util import utcnow, iso, parse

log = logging.getLogger('scheduler')
AUTO_CYCLE_SECONDS = 60


async def snapshot_token():
    live = await market.get_token_live()
    now = utcnow()
    await db.token_snapshots.insert_one({
        't': iso(now), 'price_usd': live['price_usd'], 'price_sol': live['price_sol'],
        'market_cap_usd': live['market_cap_usd'], 'real_sol_reserves_sol': live['real_sol_reserves_sol'],
        'volume_24h_usd': live['volume_24h_usd'], 'sol_price_usd': live['sol_price_usd'],
    })
    await db.token_snapshots.delete_many({'t': {'$lt': iso(now - timedelta(hours=48))}})


async def scheduler_loop():
    await asyncio.sleep(3)
    last_snapshot = 0.0
    while True:
        try:
            now = utcnow()
            await flywheel.tick(now)
            app = await get_app_state()
            last_cycle = parse(app['last_cycle_at']) if app.get('last_cycle_at') else None
            if app.get('auto_cycle') and (not last_cycle or (now - last_cycle).total_seconds() >= AUTO_CYCLE_SECONDS):
                await run_cycle('auto')
            if time.time() - last_snapshot >= 60:
                await snapshot_token()
                last_snapshot = time.time()
        except Exception as e:
            log.warning('scheduler tick failed: %s', e)
        await asyncio.sleep(15)
