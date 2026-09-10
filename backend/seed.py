import logging
from db import db
from services import flywheel
from services.events import get_app_state, add_event
from services.util import utcnow, iso

log = logging.getLogger('seed')
PURGE_MARKER = 'real_only_since'
PURGED = ('leads', 'clients', 'approvals', 'events', 'payments', 'withdrawals', 'flywheel_ledger', 'flywheel_state',
          'flywheel_config', 'buyback_intents', 'alerts', 'treasury_activity')


async def ensure_seed():
    app = await db.app_state.find_one({'key': 'state'})
    if not app or not app.get(PURGE_MARKER):
        for c in PURGED:
            await db[c].delete_many({})
        await db.app_state.update_one({'key': 'state'}, {'$set': {'cycles_count': 0, 'auto_cycle': False, 'last_cycle_at': None, PURGE_MARKER: iso(utcnow())}}, upsert=True)
        await add_event('DIRECTOR', 'REAL-ONLY MODE ENABLED: every simulated record was purged. From here on the ledger only holds on-chain verified SOL payments, transfers and Director-signed buybacks.', 'gate')
        log.info('purged simulated data; real-only mode enabled')
    await get_app_state()
    await flywheel.get_config()
    await flywheel.get_state()
    await db.treasury_activity.create_index('signature', unique=True)
    await db.payments.create_index('tx_signature')
