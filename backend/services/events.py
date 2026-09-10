from db import db
from services.util import utcnow, iso, new_id


async def get_app_state():
    doc = await db.app_state.find_one({'key': 'state'}, {'_id': 0})
    if not doc:
        doc = {'key': 'state', 'cycles_count': 42, 'auto_cycle': False, 'last_cycle_at': None}
        await db.app_state.insert_one(dict(doc))
    return doc


async def add_event(agent: str, message: str, severity: str = 'normal', cycle_n=None):
    if cycle_n is None:
        cycle_n = (await get_app_state())['cycles_count']
    doc = {
        'id': new_id('ev-'),
        'cycle_n': cycle_n,
        'agent': agent,
        'message': message,
        'severity': severity,
        'created_at': iso(utcnow()),
    }
    await db.events.insert_one(dict(doc))
    return doc
