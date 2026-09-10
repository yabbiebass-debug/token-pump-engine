"""Distributed executor node runner.

One process per machine/wallet. Registers with the leader, heartbeats,
and asks the leader for its share of each window's capacity.

Usage:
  set LEADER_URL=http://leader:8000
  set NODE_API_KEY=<shared key>
  set NODE_ID=node-1 NODE_WALLET=<its solana pubkey> NODE_CAPACITY_SOL=0.25
  python node_runner.py            # heartbeat-only mode (leader plans fills)
  python node_runner.py --once     # single heartbeat + plan print, then exit

Fill execution itself stays Director-signed per wallet: the leader's
/api/nodes/plan tells each operator how much to buy; each node pastes
its signature back via /api/live/confirm. No private key ever leaves
its host.
"""
import argparse
import os
import sys
import time
import urllib.request
import json

LEADER = os.environ.get('LEADER_URL', 'http://localhost:8000').rstrip('/')
KEY = os.environ.get('NODE_API_KEY', '')
NODE_ID = os.environ.get('NODE_ID', 'node-1')
WALLET = os.environ.get('NODE_WALLET', '')
CAP = float(os.environ.get('NODE_CAPACITY_SOL', '0.25'))


def call(method: str, path: str, body: dict = None):
    req = urllib.request.Request(
        LEADER + path,
        data=json.dumps(body or {}).encode() if body is not None else None,
        method=method,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {KEY}'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode() or '{}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--once', action='store_true')
    args = ap.parse_args()
    if not KEY:
        sys.exit('NODE_API_KEY not set')
    if not WALLET:
        sys.exit('NODE_WALLET not set')
    print(f'[node] registering {NODE_ID} wallet={WALLET[:6]}… cap={CAP} SOL → {LEADER}', flush=True)
    print(call('POST', '/api/nodes/register', {
        'node_id': NODE_ID, 'wallet': WALLET, 'capacity_sol': CAP,
        'meta': {'runner': 'node_runner.py'}}))
    while True:
        hb = call('POST', '/api/nodes/heartbeat', {'node_id': NODE_ID, 'status': {'ts': time.time()}})
        print(f"[node] heartbeat ok healthy_nodes_planned={hb.get('node_id')}", flush=True)
        if args.once:
            break
        time.sleep(45)


if __name__ == '__main__':
    main()
