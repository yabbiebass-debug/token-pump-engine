"""End-to-end backend tests for YABBAI Forge · $BASH Flywheel API."""
import os
import time
import pytest
import requests

BASE = os.environ.get('REACT_APP_BACKEND_URL', 'https://token-pump-engine.preview.emergentagent.com').rstrip('/')
API = f'{BASE}/api'


@pytest.fixture(scope='session')
def s():
    ses = requests.Session()
    ses.headers.update({'Content-Type': 'application/json'})
    return ses


# ---------- flywheel status ----------
class TestFlywheelStatus:
    def test_status_shape(self, s):
        r = s.get(f'{API}/flywheel/status', timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ('config', 'state', 'derived', 'token'):
            assert k in d
        assert d['token']['symbol'] == 'BASH'
        assert d['token']['price_sol'] > 0
        assert 'curve_progress_pct' in d['token']
        assert d['token']['sol_price_usd'] > 0
        assert isinstance(d['derived']['governor_active'], bool)
        wu = d['derived']['window_usage_pct']
        assert 0 <= wu <= 100


# ---------- cycle ----------
class TestCycle:
    def test_run_cycle(self, s):
        pre = s.get(f'{API}/state', timeout=30).json()['state']
        before_count = pre['cycles_count']
        r = s.post(f'{API}/cycle/run', timeout=60)
        assert r.status_code == 200
        d = r.json()
        # 8 stage events + summary = 9
        assert len(d['events']) == 9
        stage_events = [e for e in d['events'] if '· tap +' in (e.get('message') or '')]
        assert len(stage_events) >= 8
        assert d['taps_sol'] > 0
        assert d.get('approval') and d['approval']['status'] == 'pending'
        assert d['injection']['status'] in ('injected', 'delayed', 'below_min')
        # verify state
        post = s.get(f'{API}/state', timeout=30).json()
        assert post['state']['cycles_count'] == before_count + 1
        assert any(a['id'] == d['approval']['id'] and a['status'] == 'pending' for a in post['approvals'])


# ---------- payments ----------
class TestPayments:
    def test_payment_fork_maintain_promo(self, s):
        body = {'biz': 'TEST_Basham Co', 'email': 'test@example.com', 'package': 'Fork',
                'tier': 'Maintain', 'method': 'solana', 'promo_code': 'PULSE250', 'scope': '', 'sol_signature': ''}
        r = s.post(f'{API}/payments', json=body, timeout=30)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d['payment']['amount_usd'] == 650
        assert d['payment'].get('sol_amount', 0) > 0
        assert d['client']['status'] == 'QUEUED'
        fly = d['flywheel']
        assert 'allocation' in fly and fly['allocation']['amount_sol'] > 0
        assert 'injection' in fly and 'status' in fly['injection']

    def test_custom_below_min(self, s):
        body = {'biz': 'TEST_x', 'email': '', 'package': 'Custom', 'tier': 'Maintain',
                'method': 'card', 'promo_code': '', 'scope': '', 'sol_signature': '', 'custom_fee': 400}
        r = s.post(f'{API}/payments', json=body, timeout=30)
        assert r.status_code == 400

    def test_unknown_package(self, s):
        body = {'biz': 'TEST_x', 'email': '', 'package': 'Nope', 'tier': 'Maintain',
                'method': 'card', 'promo_code': '', 'scope': '', 'sol_signature': ''}
        r = s.post(f'{API}/payments', json=body, timeout=30)
        assert r.status_code == 400


# ---------- flywheel fast-forward & ledger ----------
class TestFlywheelFF:
    def test_fast_forward_and_ledger(self, s):
        r = s.post(f'{API}/flywheel/fast-forward', timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d['conversion']['mined_amount'] > 0
        assert d['conversion']['amount_sol'] > 0
        assert d['injection']['status'] == 'injected'
        assert d['injection']['tokens_acquired'] > 0

        led = s.get(f'{API}/flywheel/ledger', timeout=30).json()
        types = {e['type'] for e in led}
        for t in ('allocation', 'stage_tap', 'conversion', 'injection'):
            assert t in types, f'missing type {t}, got {types}'
        # delayed may or may not exist depending on capacity; check filter works instead
        filt = s.get(f'{API}/flywheel/ledger?type=injection', timeout=30).json()
        assert all(e['type'] == 'injection' for e in filt)


# ---------- inject governor + config ----------
class TestFlywheelConfig:
    def test_inject_after_ff_may_delay(self, s):
        # Immediately after fast-forward, capacity used; another inject should probably delay
        r = s.post(f'{API}/flywheel/inject', timeout=30)
        assert r.status_code == 200
        d = r.json()
        # accepted values: delayed OR below_min OR injected (if capacity remains)
        assert d['status'] in ('delayed', 'below_min', 'injected')
        if d['status'] == 'delayed':
            assert 'resumes_at' in d

    def test_get_put_config(self, s):
        r = s.get(f'{API}/flywheel/config', timeout=30)
        assert r.status_code == 200
        orig = r.json()['hourly_capacity_sol']
        try:
            r2 = s.put(f'{API}/flywheel/config', json={'hourly_capacity_sol': 0.5}, timeout=30)
            assert r2.status_code == 200
            assert r2.json()['hourly_capacity_sol'] == 0.5
            r3 = s.put(f'{API}/flywheel/config', json={'buyback_pct': 2}, timeout=30)
            assert r3.status_code == 422
        finally:
            s.put(f'{API}/flywheel/config', json={'hourly_capacity_sol': orig}, timeout=30)


# ---------- leads & approvals ----------
class TestLeadsApprovals:
    def test_create_and_move_lead(self, s):
        body = {'biz': 'TEST_Trail Co', 'niche': 'Outdoors', 'region': 'USA', 'email': 'a@b.co',
                'phone': '', 'pain': '', 'source': 'test', 'estimatedValue': 0}
        r = s.post(f'{API}/leads', json=body, timeout=30)
        assert r.status_code == 201, r.text
        lead = r.json()
        assert lead['stage'] == 'SCOUT'
        assert 80 <= lead['score'] <= 99

        r2 = s.patch(f"{API}/leads/{lead['id']}/stage", json={'stage': 'QUALIFY'}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()['stage'] == 'QUALIFY'

        r3 = s.patch(f"{API}/leads/{lead['id']}/stage", json={'stage': 'BOGUS'}, timeout=30)
        assert r3.status_code == 422

    def test_approve_pending(self, s):
        # trigger cycle to create a pending approval
        c = s.post(f'{API}/cycle/run', timeout=60).json()
        ap = c['approval']
        r = s.post(f"{API}/approvals/{ap['id']}/approve", timeout=30)
        assert r.status_code == 200
        assert r.json()['status'] == 'approved'
        r2 = s.post(f"{API}/approvals/{ap['id']}/approve", timeout=30)
        assert r2.status_code == 404


# ---------- vault & withdrawals ----------
class TestVault:
    def test_vault_shape(self, s):
        r = s.get(f'{API}/vault', timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ('deposited_sol', 'withdrawn_sol', 'available_sol'):
            assert k in d

    def test_withdrawal_simulated(self, s):
        v = s.get(f'{API}/vault', timeout=30).json()
        amt = min(0.001, v['available_sol'] / 2)
        if amt <= 0:
            pytest.skip('no available balance')
        body = {'amount_sol': amt, 'destination_wallet': 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i',
                'memo': 'TEST', 'mode': 'simulated', 'signature': ''}
        r = s.post(f'{API}/withdrawals', json=body, timeout=30)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d['tx_mode'] == 'simulated'
        assert d['tx_signature'].startswith('YABBAI-LEDGER-')

    def test_withdrawal_over_available(self, s):
        v = s.get(f'{API}/vault', timeout=30).json()
        body = {'amount_sol': v['available_sol'] + 1000, 'destination_wallet': 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i',
                'memo': '', 'mode': 'simulated', 'signature': ''}
        r = s.post(f'{API}/withdrawals', json=body, timeout=30)
        assert r.status_code == 400

    def test_withdrawal_attest_no_sig(self, s):
        body = {'amount_sol': 0.001, 'destination_wallet': 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i',
                'memo': '', 'mode': 'attest', 'signature': ''}
        r = s.post(f'{API}/withdrawals', json=body, timeout=30)
        assert r.status_code == 400

    def test_withdrawal_attest_real_sig(self, s):
        v = s.get(f'{API}/vault', timeout=30).json()
        if v['available_sol'] < 0.01:
            pytest.skip('need 0.01 SOL')
        body = {'amount_sol': 0.01,
                'destination_wallet': 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i',
                'memo': 'test-attest', 'mode': 'attest',
                'signature': '4t39fjyTZGijZST5qjFZEwikFXwfifdhqYHjDV82LFuHi31rxnj3rP7UtxA9LqgYNvfFuWAJ5Nh26P5gz8LDpUqi'}
        r = s.post(f'{API}/withdrawals', json=body, timeout=45)
        assert r.status_code == 201, r.text
        d = r.json()
        assert d['tx_mode'] == 'onchain'
        assert d['verified_onchain'] is True
        assert d.get('slot')


# ---------- market/wallet/meta/state ----------
class TestMarket:
    def test_token_live(self, s):
        r = s.get(f'{API}/token/live', timeout=45)
        assert r.status_code == 200

    def test_sol_price(self, s):
        r = s.get(f'{API}/market/sol', timeout=30)
        assert r.status_code == 200
        assert r.json()['usd'] > 0

    def test_wallet(self, s):
        r = s.get(f'{API}/wallet/HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i', timeout=45)
        assert r.status_code == 200
        d = r.json()
        assert 'balance_sol' in d
        assert isinstance(d.get('signatures'), list)

    def test_meta(self, s):
        r = s.get(f'{API}/meta', timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d['agents']) == 9
        assert len(d['packages']) == 3
        assert len(d['tiers']) == 3

    def test_auto_cycle_toggle(self, s):
        for val in (True, False):
            r = s.patch(f'{API}/state/auto-cycle', json={'auto_cycle': val}, timeout=30)
            assert r.status_code == 200
            assert r.json()['auto_cycle'] == val


# ---------- agent demo ----------
class TestAgentDemo:
    def test_agent_reply(self, s):
        body = {'agentType': 'quoter', 'userInput': 'A trip planner for a hiking club', 'sessionId': 't1'}
        r = s.post(f'{API}/agent-demo', json=body, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert d['reply']
        assert d['source'] in ('gemini-3-flash-preview', 'fallback') or 'gemini' in (d['source'] or '') or d['source'] == 'fallback'

    def test_agent_stream(self, s):
        body = {'agentType': 'quoter', 'userInput': 'Build a trip planner', 'sessionId': 't2'}
        with s.post(f'{API}/agent-demo/stream', json=body, timeout=90, stream=True) as r:
            assert r.status_code == 200
            assert 'text/event-stream' in r.headers.get('content-type', '')
            got_done = False
            lines = []
            for line in r.iter_lines(decode_unicode=True):
                if not line:
                    continue
                lines.append(line)
                if line.startswith('data:') and '"done": true' in line.replace(' ', '').replace('"done":true', '"done": true') or '"done":true' in line:
                    got_done = True
                    break
            assert any(l.startswith('data:') for l in lines)
            assert got_done
