import React from 'react';
import { Panel, Eyebrow, Tag } from '@/components/kit/Primitives';

const MODELS = [
  ['Lead', 'biz · niche · region · pain · fit · score · stage · source · estimatedValue'],
  ['Client', 'biz · package · setup_fee · tier · mrr · status · build_pct · health · payment_id · deliverables (created only from a verified SOL payment)'],
  ['Approval', 'type · title · detail · payload · agent · status (pending/approved/rejected)'],
  ['Payment', 'biz · package · tier · amount_usd · sol_amount · quoted_sol · tx_signature · payer_wallet · slot · verified_onchain = true'],
  ['Withdrawal', 'amount_sol · fee_sol · destination_wallet · tx_signature · slot · authorised_by · verified_onchain = true (amount + destination read from the tx)'],
  ['TreasuryActivity', 'signature · kind (deposit / transfer_out / buyback / token_out / failed) · sol_delta · token_delta · counterparty · payment_id · withdrawal_id · ledger_id'],
  ['FlywheelLedger', 'type (allocation / delayed / injection) · amount_sol · tokens_acquired · impact_pct · trigger · tx_signature · signed_by · resumes_at'],
  ['FlywheelState', 'buyback_reserve_sol · window_injected_sol · total_allocated_sol · total_injected_sol · total_tokens_acquired · injections_count · delays_count'],
  ['TokenSnapshot', 't · price_usd · price_sol · market_cap_usd · real_sol_reserves_sol · volume_24h_usd (48h retention)'],
];

const WIRES = [
  ['pump.fun frontend-api v3', 'Bonding-curve reserves, price, ATH, creator, completion flag for the $BASH mint', 'green'],
  ['DexScreener', 'USD price, 24h volume, price change, pair address', 'green'],
  ['Jupiter price v3', 'SOL/USD reference rate (fallback: DexScreener ratio)', 'green'],
  ['Solana JSON-RPC (mainnet-beta)', 'Treasury SOL + $BASH balances, transaction history indexing, SOL checkout verification (≥97% of quote), transfer verification', 'green'],
  ['Jupiter Swap API (lite)', 'Quote + unsigned swap transaction for buybacks, routed through the pump.fun bonding curve', 'green'],
  ['Solana wallet adapter (Phantom / Solflare)', 'Customers pay in SOL, the Director signs buybacks and treasury transfers in-browser; the server never sees a key', 'green'],
  ['Gemini (server-side stream)', 'Agent demo sandbox — QUALIFIER, FORGE, SHIPPER personas over SSE', 'purple'],
  ['Telegram Bot API', 'Posts every governor release, executed buyback and delay to the Director chat (env-configured)', 'purple'],
  ['JWT Director auth', 'bcrypt + 15-min access / 7-day refresh tokens; gates, config, transfers, cycle controls locked', 'amber'],
  ['MongoDB', 'All state, ledgers, on-chain activity index and snapshots', 'dim'],
];

export const WiringTab = ({ fly }) => {
  const c = fly?.config;
  return (
    <div className="space-y-4" data-testid="wiring-tab">
      <Panel className="p-5">
        <Eyebrow className="mb-3">Engine rules (live config)</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[11px]">
          {c && [
            ['On verified SOL payment', `${(c.buyback_pct * 100).toFixed(0)}% of the SOL received → buyback reserve`],
            ['Governor', `max ${c.hourly_capacity_sol} SOL released per ${c.window_min}-min window · excess delayed to next window`],
            ['Buyback', `≥ ${c.min_injection_sol} SOL · Director-signed pump.fun buy from ${c.signer_wallet.slice(0, 6)}… · floor ${c.min_wallet_balance_sol} SOL · slippage ≤ ${c.max_slippage_bps} bps`],
            ['Checkout', 'SOL only · accepted when treasury received ≥ 97% of the quote · one signature per payment'],
            ['Treasury transfers', 'Signed in-browser by the treasury wallet or attested by signature; amount + destination read from the tx'],
            ['Cycle', 'Refreshes on-chain balances, indexes new treasury tx, asks the governor for a release — no fabricated activity'],
          ].map(([k, v]) => <div key={k} className="border border-line-subtle bg-void/50 rounded-sm p-3"><div className="text-[9px] uppercase tracking-[1.5px] text-purple font-bold">{k}</div><div className="mt-1 text-ink">{v}</div></div>)}
        </div>
      </Panel>
      <Panel className="p-5">
        <Eyebrow className="mb-3">Data model</Eyebrow>
        <div className="grid gap-2 md:grid-cols-2">
          {MODELS.map(([n, f]) => <div key={n} className="border border-line-subtle rounded-sm p-3 text-[10.5px]"><span className="font-display font-black text-[11px]">{n}</span><div className="text-dim mt-1 leading-relaxed">{f}</div></div>)}
        </div>
      </Panel>
      <Panel className="p-5">
        <Eyebrow className="mb-3">External wiring</Eyebrow>
        <div className="space-y-2">
          {WIRES.map(([n, d, t]) => <div key={n} className="flex flex-wrap items-center gap-3 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px]"><Tag tone={t}>{n}</Tag><span className="text-dim">{d}</span></div>)}
        </div>
        <p className="text-[10px] text-dim2 mt-4 leading-relaxed">Safety envelope: the server never holds a private key and there is no simulation mode. Each governor release becomes one Jupiter-built pump.fun buy that the logged-in Director signs from the single disclosed treasury wallet; the backend verifies the SOL and $BASH deltas on-chain before ledgering and alerting. One wallet, public ledger, per-window cap — no multi-wallet or hidden buying.</p>
      </Panel>
    </div>
  );
};
