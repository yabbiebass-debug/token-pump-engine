# YabbAI Forge v2 · $BASH Flywheel — PRD

## Original problem statement
"build this - https://github.com/bashammm/YABBAI---BASHAM-AUTO … every purchase and every loop there's something at every stage a process to pump a token … injecting profits convertible to SOL … every hour from hash mining another currency then converting it to SOL for injected process of pumping the token and the hashes will delay a pump once reached a certain ongoing capacity then it tokenizes on and up stream. pump.fun token https://pump.fun/coin/7cnu3w5SbTxCrYTPavBJ7dib4Bdnf6mN5AG98xzDpump — UPGRADE THE WHOLE BUILD"

Source repo = "YabbAI Forge": Vite/TS single-page demo (open-source product foundry, 8-stage agent loop with Director gates, demo payments, SOL vault, Pulse game, Gemini agent demo) with localStorage state.
Token = **$BASH — BASH AUTONOMOUS TERMINAL** (pump.fun, still on bonding curve; creator wallet = repo SOL_RECIPIENT `HTN1fv…ZV5i`).

## Safety framing (decided 2026-06)
- Buybacks are **SIMULATED (paper) mode only**: computed against the live pump.fun constant-product curve (1% fee), ledgered, never broadcast. No private keys. Mode is not a toggle.
- Payments are demo captures (no real charge) — clearly labelled in UI.
- Framed as a transparent, revenue-funded buyback treasury ("flywheel") with a capacity governor, not covert price manipulation. No wash trading / multi-wallet features.

## Architecture
- **Backend** FastAPI + Motor/MongoDB, all routes under `/api`. Background asyncio scheduler (15s tick): mining accrual, interval conversion, governor window roll, auto-cycle (60s), token snapshots (60s, 48h retention).
  - `services/flywheel.py` engine: allocate_from_payment · stage_tap · accrue · convert_mined · roll_window · try_inject (governor + curve math) · hourly_job · fast_forward_hour · status
  - `services/cycle.py` run_cycle (8 stage events + taps + approval + REINVEST injection)
  - `services/market.py` pump.fun v3 + DexScreener + Jupiter SOL price + CoinGecko (mined coin) + Solana JSON-RPC (wallet/verify); in-memory caches
  - `services/agent.py` Gemini `gemini-3-flash-preview` via emergentintegrations (EMERGENT_LLM_KEY), SSE streaming, canned fallback
  - Collections: leads, clients, approvals, events, payments, withdrawals, app_state, flywheel_config, flywheel_state, flywheel_ledger, token_snapshots, agent_demo_logs
- **Frontend** React 19 (CRA/craco) + Tailwind + react-query + recharts + sonner. Solana-brand palette (void/purple/green/amber), Unbounded + JetBrains Mono.
  - Routes: `/` Home · `/pricing` · `/mission` · `/flywheel` · `/pulse`
- **Env**: backend `.env` has MONGO_URL, DB_NAME, CORS_ORIGINS, EMERGENT_LLM_KEY, SOLANA_RPC_URL.

## Key API
GET /api/state · /api/meta · PATCH /api/state/auto-cycle · POST /api/cycle/run · POST/GET /api/leads · PATCH /api/leads/{id}/stage · POST /api/approvals/{id}/approve|reject · POST/GET /api/payments · GET /api/vault · POST/GET /api/withdrawals (simulated | attest via RPC) · GET /api/flywheel/status|config|ledger|history · PUT /api/flywheel/config · POST /api/flywheel/fast-forward|inject|convert · GET /api/token/live · /api/market/sol · /api/wallet/{addr} · POST /api/wallet/verify · POST /api/agent-demo[/stream]

## Flywheel rules (defaults, configurable in UI)
buyback_pct 15% of each purchase · stage_tap_pct 0.25% of MRR × 8 stages per cycle · hashrate 250 kH/s XMR @ 4.5e-6 coin/kH/s/h · conversion & governor window 60 min · cap 0.25 SOL/window (excess → DELAYED ledger entry, resumes next window) · min injection 0.005 SOL · graduation target 85 SOL (→ PumpSwap "upstream").

## Implemented (2026-06-10) — tested via testing_agent iteration_1 (22/22 backend, all frontend flows pass)
- Full port of v1 features to persistent backend: leads, clients (BUILDER advances build %), Director gates, cycle log, demo checkout (card/PayPal/SOL + PULSE250), SOL vault + withdrawals (simulated ledger or on-chain signature attestation verified via RPC), live treasury wallet panel, Pulse reflex game (unlocks voucher), Gemini streaming agent sandbox, audit calculator.
- NEW Flywheel: live $BASH header, 8-node pipeline diagram, reserve panel (inflow breakdown, sim position mark-to-market, Inject/Convert/+1h controls), governor panel, curve→graduation progress (live vs projected), charts (cumulative injections, mcap snapshots), filterable ledger, config panel.
- Token ticker strip + nav live price; hero live token card.

## Backlog
- P1: Director auth (JWT or Emergent Google) to protect gate/config/withdraw actions
- P1: Real Solana checkout verification (match signature amount/recipient on-chain before confirming payment)
- P2: Public read-only "transparency" page / shareable ledger export (CSV)
- P2: Live execution path (Director-held signer, Jupiter/pump.fun swap) — explicitly out of scope for this build
- P2: Historical charts for reserve & governor windows; email/Telegram alerts on injections & delays
- P3: Persist Pulse scores/leaderboard server-side
