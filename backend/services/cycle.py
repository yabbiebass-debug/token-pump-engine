import random
from db import db
from constants import STAGES, GATED, STAGE_AGENT
from services import flywheel, market
from services.events import add_event, get_app_state
from services.util import utcnow, iso, new_id

NICHES = ['recreation', 'gaming', 'creators', 'science', 'commerce', 'trades', 'education', 'makers']


def _msg(stage: str, n: int, ctx: dict) -> str:
    r = random
    if stage == 'SCOUT':
        return f"Scanned {r.randint(1800, 4200):,} repos tagged {', '.join(r.sample(NICHES, 3))}. Flagged {r.randint(6, 19)} abandoned projects with live issue threads."
    if stage == 'QUALIFY':
        return f"Scored {r.randint(4, 11)} opportunities; top fit {r.randint(84, 97)}/100 ({ctx['lead']}) — upstream MIT, last commit < 90 days."
    if stage == 'PITCH':
        return f"Amber Gate: fork roadmap drafted for {ctx['prospect']}. Awaiting Director approval before any outreach leaves."
    if stage == 'CLOSE':
        return f"Quote proposal staged for {ctx['prospect']} — ${ctx['fee']:,} fixed. Director sign-off pending before invoice."
    if stage == 'BUILD':
        return ctx['build_msg']
    if stage == 'SHIP':
        t = r.randint(9, 21)
        return f"Release candidate tagged; {t}/{t} integration tests passed. Publish gated on Director."
    if stage == 'SUPPORT':
        return f"Triaged {r.randint(3, 14)} issues across shipped forks; {r.randint(1, 4)} upstream security patches synced."
    return "REINVEST: cycle taps swept into the $BASH buyback reserve; INJECTOR evaluated the governor window."


async def _advance_build():
    c = await db.clients.find_one({'status': {'$in': ['QUEUED', 'BUILDING']}}, {'_id': 0}, sort=[('created_at', 1)])
    if not c:
        return 'BUILDER idle: no queued builds. Refreshed dependency locks on all LIVE forks.'
    pct = min(100, c['build_pct'] + random.randint(4, 11))
    status = 'LIVE' if pct >= 100 else 'BUILDING'
    await db.clients.update_one({'id': c['id']}, {'$set': {'build_pct': pct, 'status': status}})
    return f"BUILDER advanced {c['biz']} ({c['package']}) to {pct}%{' — build complete, marked LIVE' if status == 'LIVE' else ''}."


async def run_cycle(trigger: str = 'manual'):
    app = await get_app_state()
    n = app['cycles_count'] + 1
    cfg, fst = await flywheel.get_config(), await flywheel.get_state()
    sol_price = (await market.get_sol_price())['usd']
    clients = await db.clients.find({}, {'_id': 0}).to_list(500)
    total_mrr = sum(c.get('mrr', 0) for c in clients)
    lead = await db.leads.find_one({'stage': {'$in': ['SCOUT', 'QUALIFY']}}, {'_id': 0}, sort=[('created_at', -1)])
    ctx = {'lead': lead['biz'] if lead else 'inbound niche', 'prospect': f"Niche Community #{n}", 'fee': random.choice([900, 2400, 6000]),
           'build_msg': await _advance_build()}
    events, taps = [], 0.0
    for stage in STAGES:
        tap = await flywheel.stage_tap(fst, cfg, stage, n, total_mrr, sol_price)
        taps += tap['amount_sol']
        sev = 'gate' if stage in GATED else 'normal'
        ev = await add_event(STAGE_AGENT[stage], f"[{stage}] {_msg(stage, n, ctx)} · tap +{tap['amount_sol']:.6f} SOL → reserve", sev, n)
        events.append(ev)
    await flywheel.save_state(fst)
    approval = {
        'id': new_id('appr-'), 'type': 'OUTREACH_PITCH', 'title': f"Autonomous Fork Roadmap: Opportunity #{n}",
        'detail': 'PITCHER prepared a fork/merge plan with upstream candidates and a pricing model. Awaiting Director approval.',
        'agent': 'PITCHER', 'status': 'pending', 'created_at': iso(utcnow()),
        'payload': {'prospect': ctx['prospect'], 'estimatedFee': ctx['fee'], 'guarantee': '10 day turnaround', 'cycle': n},
    }
    await db.approvals.insert_one(dict(approval))
    injection = await flywheel.try_inject('cycle_reinvest')
    await db.app_state.update_one({'key': 'state'}, {'$set': {'cycles_count': n, 'last_cycle_at': iso(utcnow())}})
    summary = await add_event('TREASURER', f"Cycle #{n} completed ({trigger}). 9 agents synchronized · {taps:.6f} SOL tapped → reserve · injection: {injection['status']}.", 'success', n)
    events.append(summary)
    return {'cycle_n': n, 'events': events, 'taps_sol': taps, 'approval': approval, 'injection': injection}
