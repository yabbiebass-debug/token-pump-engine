from db import db
from constants import STAGES, GATED, STAGE_AGENT, TOKEN_MINT
from services import flywheel, market, treasury, mining
from services.events import add_event, get_app_state
from services.live import wallet_snapshot
from services.util import utcnow, iso

STATUS_LABEL = {'below_min': 'reserve below minimum — nothing released', 'delayed': 'governor cap reached — delayed', 'awaiting_signature': 'released — awaiting Director signature'}


async def run_cycle(trigger: str = 'manual'):
    app = await get_app_state()
    n = app['cycles_count'] + 1
    cfg, st = await flywheel.get_config(), await flywheel.get_state()
    leads = await db.leads.find({}, {'_id': 0, 'stage': 1, 'biz': 1, 'score': 1}).to_list(1000)
    clients = await db.clients.find({}, {'_id': 0, 'status': 1, 'mrr': 1}).to_list(1000)
    pending = await db.approvals.count_documents({'status': 'pending'})
    payments = await db.payments.find({'verified_onchain': True}, {'_id': 0, 'sol_amount': 1}).to_list(5000)
    by_stage = {s: sum(1 for l in leads if l['stage'] == s) for s in STAGES}
    open_leads = [l for l in leads if l['stage'] not in ('LOST', 'SUPPORT')]
    top = max(open_leads, key=lambda l: l.get('score', 0), default=None)
    market.invalidate(f"wallet:{cfg['signer_wallet']}", f"tokbal:{cfg['signer_wallet']}:{TOKEN_MINT}")
    snap = await wallet_snapshot(cfg['signer_wallet'])
    new_tx = await treasury.sync_if_stale(0)
    await mining.sync_if_stale(0)
    try:
        mine = await mining.status()
    except Exception:
        mine = None
    queued = sum(1 for c in clients if c['status'] == 'QUEUED')
    building = sum(1 for c in clients if c['status'] in ('BUILDING', 'TESTING'))
    live_clients = sum(1 for c in clients if c['status'] == 'LIVE')
    mrr = sum(c.get('mrr', 0) for c in clients)
    received = sum(p.get('sol_amount') or 0 for p in payments)
    injection = await flywheel.try_inject('cycle_reinvest')
    chain = (f"{snap['balance_sol']:.4f} SOL · {snap['token_balance']:,.0f} $BASH on-chain (slot {snap['slot']})" if snap['ok'] else 'RPC unavailable — balances not refreshed')
    msgs = {
        'SCOUT': f"Pipeline: {len(open_leads)} open lead(s) — " + ', '.join(f'{k} {v}' for k, v in by_stage.items() if v) if open_leads else 'Pipeline empty — add a lead from Mission Control or via checkout.',
        'QUALIFY': f"Top fit: {top['biz']} ({top.get('score', 0)}/100, {top['stage']})." if top else 'No open leads to qualify.',
        'PITCH': f"{pending} Director gate(s) awaiting sign-off." if pending else 'No pending Director gates.',
        'CLOSE': f"{len(payments)} verified SOL payment(s) · {received:.4f} SOL received on-chain · MRR ${mrr:,.0f}.",
        'BUILD': f"{queued} queued · {building} in progress · {live_clients} live." if clients else 'No client builds yet.',
        'SHIP': f"{live_clients} shipped product(s) live." if live_clients else 'Nothing ready to ship.',
        'SUPPORT': f"Treasury {chain} · {len(new_tx)} new on-chain tx indexed · unMineable pending {mine['pending_sol']:.5f} SOL ({mine['workers_online']} worker(s) online)." if mine else f"Treasury {chain} · {len(new_tx)} new on-chain tx indexed.",
        'REINVEST': f"Reserve {st['buyback_reserve_sol']:.4f} SOL · governor: {STATUS_LABEL.get(injection['status'], injection['status'])}.",
    }
    events = [await add_event(STAGE_AGENT[stage], f"[{stage}] {msgs[stage]}", 'gate' if stage in GATED and pending else 'normal', n) for stage in STAGES]
    await db.app_state.update_one({'key': 'state'}, {'$set': {'cycles_count': n, 'last_cycle_at': iso(utcnow())}})
    events.append(await add_event('TREASURER', f"Cycle #{n} completed ({trigger}). Real balances refreshed · buyback: {injection['status']}.", 'success', n))
    return {'cycle_n': n, 'events': events, 'injection': injection, 'new_activity': len(new_tx), 'wallet': snap}
