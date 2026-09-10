"""Distributed node registry: fan buy pressure across many wallets/machines.

Nodes are separate hosts (or separate wallets on one host) that each run
the executor loop against the same token. The leader splits each window's
capacity across healthy nodes so no single wallet eats the full governor
cap — parallel buys land in the same block window, which is what outruns
single-threaded sniper bots to the bonding curve.

Node auth: shared NODE_API_KEY bearer header. Heartbeats every ≤60s mark
a node healthy. Stale nodes (>180s) are skipped automatically.
"""
import logging
import os
import secrets
from datetime import timedelta

from db import db
from services.util import iso, parse, utcnow

log = logging.getLogger('nodes')
STALE_AFTER_S = 180


def node_api_key() -> str:
    return os.environ.get('NODE_API_KEY') or ''


def check_key(provided: str) -> bool:
    expected = node_api_key()
    return bool(expected) and secrets.compare_digest(provided or '', expected)


async def register(node_id: str, wallet: str, capacity_sol: float, meta: dict = None) -> dict:
    doc = {'node_id': node_id, 'wallet': wallet, 'capacity_sol': float(capacity_sol),
           'meta': meta or {}, 'last_heartbeat': iso(utcnow()), 'registered_at': iso(utcnow()),
           'buys': 0, 'sol_deployed': 0.0}
    await db.exec_nodes.update_one({'node_id': node_id}, {'$set': doc}, upsert=True)
    doc.pop('_id', None)
    return doc


async def heartbeat(node_id: str, status: dict = None) -> dict:
    res = await db.exec_nodes.find_one_and_update(
        {'node_id': node_id},
        {'$set': {'last_heartbeat': iso(utcnow()), 'last_status': status or {}}},
        projection={'_id': 0}, return_document=True)
    if not res:
        raise KeyError(f'unknown node {node_id} — register first')
    return res


async def healthy_nodes() -> list:
    cutoff = utcnow() - timedelta(seconds=STALE_AFTER_S)
    out = []
    async for n in db.exec_nodes.find({}, {'_id': 0}):
        try:
            if parse(n['last_heartbeat']) >= cutoff:
                out.append(n)
        except (KeyError, ValueError):
            continue
    return out


async def plan_window(total_sol: float) -> list:
    """Split `total_sol` across healthy nodes proportional to declared capacity."""
    nodes = await healthy_nodes()
    if not nodes:
        return []
    weight = sum(max(0.0, n.get('capacity_sol', 0)) for n in nodes) or 1.0
    legs = []
    for n in nodes:
        share = total_sol * max(0.0, n.get('capacity_sol', 0)) / weight
        if share >= 0.001:
            legs.append({'node_id': n['node_id'], 'wallet': n['wallet'], 'amount_sol': round(share, 6)})
    # Dust remainder lands on the biggest node so nothing is lost.
    remainder = round(total_sol - sum(l['amount_sol'] for l in legs), 6)
    if legs and remainder > 0:
        legs[0]['amount_sol'] = round(legs[0]['amount_sol'] + remainder, 6)
    return legs


async def record_fill(node_id: str, amount_sol: float, tx_signature: str):
    await db.exec_nodes.update_one({'node_id': node_id}, {'$inc': {'buys': 1, 'sol_deployed': float(amount_sol)}})
    await db.node_fills.insert_one({'node_id': node_id, 'amount_sol': float(amount_sol),
                                    'tx_signature': tx_signature, 'created_at': iso(utcnow())})


async def list_nodes() -> list:
    nodes = await db.exec_nodes.find({}, {'_id': 0}).sort('last_heartbeat', -1).to_list(100)
    now = utcnow()
    for n in nodes:
        try:
            n['healthy'] = (now - parse(n['last_heartbeat'])).total_seconds() < STALE_AFTER_S
        except (KeyError, ValueError):
            n['healthy'] = False
    return nodes
