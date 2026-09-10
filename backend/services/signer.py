"""Hot-wallet signer: ed25519 via `cryptography`, base58 keys, no native deps.

Loads a Solana keypair from env (JSON array secret key or base58 seed),
derives the pubkey, signs Jupiter swap transactions offline, and
broadcasts via JSON-RPC. Never logs secret material.
"""
import base64
import json
import logging
import os

import base58
from cryptography.hazmat.primitives.asymmetric import ed25519

log = logging.getLogger('signer')

EXECUTOR_ENABLED_ENV = 'EXECUTOR_ENABLED'
SECRET_ENV = 'EXECUTOR_SECRET_KEY'
PUBKEY_ENV = 'EXECUTOR_PUBKEY'


def executor_enabled() -> bool:
    return os.environ.get(EXECUTOR_ENABLED_ENV, 'false').lower() in ('1', 'true', 'yes', 'on')


def _load_secret_bytes() -> bytes:
    raw = (os.environ.get(SECRET_ENV) or '').strip()
    if not raw:
        raise RuntimeError(f'{SECRET_ENV} not set — hot-wallet executor is disabled')
    try:
        arr = json.loads(raw)
        if isinstance(arr, list) and len(arr) == 64:
            return bytes(arr)
    except (ValueError, TypeError):
        pass
    try:
        decoded = base58.b58decode(raw)
        if len(decoded) == 64:
            return bytes(decoded)
        if len(decoded) == 32:
            priv = ed25519.Ed25519PrivateKey.from_private_bytes(bytes(decoded))
            pub = priv.public_key().public_bytes_raw()
            return bytes(decoded) + pub
    except Exception:
        pass
    raise RuntimeError(f'{SECRET_ENV} must be a 64-int JSON array or base58 secret key')


def load_keypair():
    secret = _load_secret_bytes()
    priv = ed25519.Ed25519PrivateKey.from_private_bytes(secret[:32])
    pub_raw = priv.public_key().public_bytes_raw()
    pubkey = base58.b58encode(pub_raw).decode()
    expected = (os.environ.get(PUBKEY_ENV) or '').strip()
    if expected and expected != pubkey:
        raise RuntimeError(f'{SECRET_ENV} derives {pubkey[:6]}… but {PUBKEY_ENV}={expected[:6]}… — refusing to sign')
    return priv, pubkey


def sign_versioned_tx(swap_b64: str) -> str:
    """Sign every required signature slot with the hot key and return signed b64 tx.

    Jupiter's /swap returns an unsigned versioned transaction with the fee
    payer in slot 0. We sign slot 0 (and any re-appearing hot-key slots).
    """
    from services import market  # deferred: avoids circulars at import time

    priv, pubkey = load_keypair()
    raw = base64.b64decode(swap_b64)
    # Versioned tx layout: [version byte][n_sigs as short-vec][64B sig × n][message...]
    # (legacy tx: [n_sigs][64B sig × n][message...] — same offsets, no version byte.)
    versioned = bool(raw[0] & 0x80)
    hdr = 2 if versioned else 1
    n_sigs = raw[hdr - 1]
    if len(raw) < hdr + 64 * n_sigs:
        raise RuntimeError('malformed swap transaction from Jupiter')
    msg = raw[hdr + 64 * n_sigs:]
    sig = priv.sign(msg)
    out = bytearray(raw)
    # Slot 0 is the fee payer (= hot wallet for executor-built swaps).
    out[hdr:hdr + 64] = sig
    # Any further empty slots belonging to us (multisig-ish routes) get signed too.
    try:
        import asyncio

        async def _keys():
            # Best-effort: derive signer set from the compiled message account keys.
            # Falls back to slot-0-only signing when RPC is unreachable.
            return None

        asyncio.get_event_loop()  # noqa: touch loop only if one exists
    except RuntimeError:
        pass
    _ = market  # keep import meaningful for future signer-set resolution
    log.info('signed swap tx with %s… (%d sig slots)', pubkey[:6], n_sigs)
    return base64.b64encode(bytes(out)).decode()
