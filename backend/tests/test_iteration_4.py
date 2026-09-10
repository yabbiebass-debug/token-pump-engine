"""Iteration 4 backend tests - REAL-ONLY mode verification."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback to reading frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

TREASURY = "HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i"
DIR_EMAIL = "bashammgaming@gmail.com"
DIR_PASS = "ChillOverdrive2017!"
HISTORIC_BUYBACK_SIG = "4t39fjyTZGijZST5qjFZEwikFXwfifdhqYHjDV82LFuHi31rxnj3rP7UtxA9LqgYNvfFuWAJ5Nh26P5gz8LDpUqi"
SIG_88 = "1" * 88


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def director_token(s):
    r = s.post(f"{API}/auth/login", json={"email": DIR_EMAIL, "password": DIR_PASS})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_hdr(director_token):
    return {"Authorization": f"Bearer {director_token}"}


# ---- Auth ----
def test_auth_me(s, auth_hdr):
    r = s.get(f"{API}/auth/me", headers=auth_hdr)
    assert r.status_code == 200
    assert r.json().get("email") == DIR_EMAIL


# ---- Vault ----
def test_vault(s):
    r = s.get(f"{API}/vault")
    assert r.status_code == 200
    d = r.json()
    assert d["address"] == TREASURY
    assert isinstance(d["balance_sol"], (int, float))
    assert isinstance(d["token_balance"], (int, float))
    assert d["deposited_sol"] == 0
    assert d["payments_count"] == 0
    assert d["reserve_sol"] == 0
    assert d["reserve_backed"] is True
    assert "available_sol" not in d


# ---- State ----
def test_state_purged(s):
    r = s.get(f"{API}/state")
    assert r.status_code == 200
    d = r.json()
    assert d["leads"] == []
    assert d["clients"] == []
    assert d["approvals"] == []
    assert d["payments"] == []
    assert d["withdrawals"] == []
    assert "real_only_since" in d.get("state", {}) or "real_only_since" in d
    # check events don't contain demo names
    evs = str(d.get("events", []))
    assert "Trailhead" not in evs
    assert "Pixel Foundry" not in evs


# ---- Flywheel status ----
def test_flywheel_status(s):
    r = s.get(f"{API}/flywheel/status")
    assert r.status_code == 200
    d = r.json()
    assert d.get("mode") == "LIVE_DIRECTOR_SIGNED"
    cfg = d["config"]
    for k in ["buyback_pct", "window_min", "hourly_capacity_sol", "min_injection_sol",
              "signer_wallet", "min_wallet_balance_sol", "max_slippage_bps"]:
        assert k in cfg, f"missing config key {k}"
    for bad in ["mode", "hashrate_khs", "mined_symbol", "stage_tap_pct", "conversion_interval_min"]:
        assert bad not in cfg, f"unexpected config key {bad}"
    st = d["state"]
    assert st.get("total_allocated_sol") == 0
    assert st.get("total_injected_sol") == 0
    assert st.get("buyback_reserve_sol") == 0
    assert "mined_balance" not in st
    assert "sim_virtual_sol" not in st
    dv = d["derived"]
    for k in ["seconds_to_window_end", "window_usage_pct", "live_curve_progress_pct", "treasury_curve_contribution_pct"]:
        assert k in dv


def test_flywheel_ledger(s):
    r = s.get(f"{API}/flywheel/ledger")
    assert r.status_code == 200
    assert r.json() == []
    r = s.get(f"{API}/flywheel/ledger.csv")
    assert r.status_code == 200
    hdr = r.text.split("\n", 1)[0]
    assert "tx_signature" in hdr
    assert "signed_by" in hdr


def test_removed_endpoints(s, auth_hdr):
    r1 = s.post(f"{API}/flywheel/fast-forward", headers=auth_hdr)
    assert r1.status_code in (404, 405), f"fast-forward returned {r1.status_code}"
    r2 = s.post(f"{API}/flywheel/convert", headers=auth_hdr)
    assert r2.status_code in (404, 405), f"convert returned {r2.status_code}"


# ---- Treasury activity ----
def test_treasury_activity(s):
    r = s.get(f"{API}/treasury/activity")
    assert r.status_code == 200
    d = r.json()
    assert d["address"] == TREASURY
    items = d["items"]
    assert isinstance(items, list)
    assert len(items) > 0
    valid_kinds = {"deposit", "transfer_out", "buyback", "token_out", "failed", "other"}
    has_buyback = False
    for it in items:
        assert "signature" in it
        assert it["kind"] in valid_kinds
        assert "sol_delta" in it and "token_delta" in it
        assert "counterparty" in it
        assert "created_at" in it
        if it["kind"] == "buyback":
            has_buyback = True
    assert has_buyback, "no buyback found in activity"
    # sorted newest first
    times = [it["created_at"] for it in items]
    assert times == sorted(times, reverse=True)


def test_treasury_sync_requires_auth(auth_hdr):
    # Use fresh unauth session to avoid login cookies
    r = requests.post(f"{API}/treasury/sync")
    assert r.status_code == 401
    r2 = requests.post(f"{API}/treasury/sync", headers=auth_hdr)
    assert r2.status_code == 200
    d = r2.json()
    assert "added" in d and "items" in d


# ---- Payments ----
def test_payment_quote(s):
    r = s.post(f"{API}/payments/quote", json={"package": "Merge", "promo_code": "PULSE250"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["fee_usd"] == 2150
    assert d["discount_usd"] == 250
    assert d["sol_amount"] > 0
    assert d["recipient"] == TREASURY
    assert d["min_ratio"] == 0.97


def test_payment_missing_signature(s):
    # no sol_signature -> 422
    r = s.post(f"{API}/payments", json={"package": "Merge"})
    assert r.status_code == 422


def test_payment_garbage_signature(s):
    r = s.post(f"{API}/payments", json={"package": "Merge", "sol_signature": "abc"})
    assert r.status_code == 422


def test_verify_sol_malformed_88(s):
    r = s.post(f"{API}/payments/verify-sol", json={"signature": SIG_88, "expected_sol": 0.001})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["valid"] is False
    assert "Malformed" in d.get("reason", "")


def test_verify_sol_historic_buyback(s):
    r = s.post(f"{API}/payments/verify-sol", json={"signature": HISTORIC_BUYBACK_SIG, "expected_sol": 0.001})
    assert r.status_code == 200, r.text
    assert r.json()["valid"] is False


# ---- Withdrawals ----
def test_withdrawals_auth():
    r = requests.post(f"{API}/withdrawals", json={"signature": "abc"})
    assert r.status_code == 401


def test_withdrawal_garbage(s, auth_hdr):
    r = s.post(f"{API}/withdrawals", json={"signature": "abc"}, headers=auth_hdr)
    assert r.status_code == 422


def test_withdrawal_malformed(s, auth_hdr):
    r = s.post(f"{API}/withdrawals", json={"signature": SIG_88}, headers=auth_hdr)
    assert r.status_code == 422
    assert "Malformed" in r.text


def test_withdrawal_historic_buyback(s, auth_hdr):
    r = s.post(f"{API}/withdrawals", json={"signature": HISTORIC_BUYBACK_SIG}, headers=auth_hdr)
    assert r.status_code == 422
    assert "buyback" in r.text.lower()


def test_withdrawals_list(s):
    r = s.get(f"{API}/withdrawals")
    assert r.status_code == 200
    assert r.json() == []


# ---- Live ----
def test_live_status(s):
    r = s.get(f"{API}/live/status")
    assert r.status_code == 200
    d = r.json()
    assert d["mode"] == "LIVE_DIRECTOR_SIGNED"
    assert "signer_wallet" in d
    assert isinstance(d["wallet"]["balance_sol"], (int, float))
    assert isinstance(d["wallet"]["token_balance"], (int, float))
    assert d["pending_intent"] is None
    assert d["injections_count"] == 0
    assert d["recent"] == []


def test_flywheel_config_mode_ignored(s, auth_hdr):
    r = s.put(f"{API}/flywheel/config", json={"mode": "SIMULATED"}, headers=auth_hdr)
    assert r.status_code in (400, 422), f"got {r.status_code}: {r.text}"


def test_flywheel_config_update(s, auth_hdr):
    r = s.put(f"{API}/flywheel/config", json={"hourly_capacity_sol": 0.25}, headers=auth_hdr)
    assert r.status_code == 200
    r2 = s.get(f"{API}/flywheel/status")
    assert r2.json()["config"]["hourly_capacity_sol"] == 0.25


def test_flywheel_inject_below_min(s, auth_hdr):
    r = s.post(f"{API}/flywheel/inject", headers=auth_hdr)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "below_min"
    assert d["reserve_sol"] == 0
    assert d["min_injection_sol"] == 0.005


def test_live_confirm_bad(s, auth_hdr):
    r = s.post(f"{API}/live/confirm", json={"signature": SIG_88}, headers=auth_hdr)
    assert r.status_code in (400, 404, 422), f"got {r.status_code}"


# ---- Cycle ----
def test_cycle_run(s, auth_hdr):
    r = s.post(f"{API}/cycle/run", headers=auth_hdr)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "cycle_n" in d
    events = d["events"]
    assert len(events) == 9, f"expected 9 events, got {len(events)}"
    assert d["injection"]["status"] == "below_min"
    assert "new_activity" in d
    assert d["wallet"]["ok"] is True
    text = " ".join(str(e) for e in events)
    # No fabricated random text
    assert "Scanned" not in text
    assert "Niche Community" not in text


# ---- Clients ----
def test_client_patch_unauth():
    r = requests.patch(f"{API}/clients/xyz", json={"build_pct": 50})
    assert r.status_code == 401


def test_client_patch_notfound(s, auth_hdr):
    r = s.patch(f"{API}/clients/xyz", json={"build_pct": 50}, headers=auth_hdr)
    assert r.status_code == 404
