import React from 'react';
import { Panel, Eyebrow, Tag } from '@/components/kit/Primitives';

const MODELS = [
  ['Lead', 'biz · niche · region · pain · fit · score · stage · source · estimatedValue'],
  ['Client', 'biz · package · setup_fee · tier · mrr · status · build_pct · health · created_via · deliverables'],
  ['Approval', 'type · title · detail · payload · agent · license · status (pending/approved/rejected)'],
  ['Payment', 'method · biz · package · tier · amount_usd · mrr · sol_amount · reference · status · simulated'],
  ['Withdrawal', 'amount_sol · destination_wallet · tx_signature · tx_mode (onchain/simulated) · slot · verified_onchain'],
  ['FlywheelLedger', 'type (allocation/stage_tap/conversion/injection/delayed) · amount_sol · tokens_acquired · impact_pct · trigger · resumes_at'],
  ['FlywheelState', 'buyback_reserve_sol · mined_balance · window_injected_sol · total_injected_sol · total_tokens_acquired · sim_virtual_*'],
  ['TokenSnapshot', 't · price_usd · price_sol · market_cap_usd · real_sol_reserves_sol · volume_24h_usd (48h retention)'],
];

const WIRES = [
  ['pump.fun frontend-api v3', 'Bonding-curve reserves, price, ATH, creator, completion flag for the $BASH mint', 'green'],
  ['DexScreener', 'USD price, 24h volume, price change, pair address', 'green'],
  ['Jupiter price v3', 'SOL/USD reference rate (fallback: DexScreener ratio)', 'green'],
  ['Solana JSON-RPC (mainnet-beta)', 'Treasury balance, recent signatures, live tx verification for attested withdrawals', 'green'],
  ['CoinGecko', 'Mined-coin USD price (XMR/KAS/…) with config fallback', 'amber'],
  ['Gemini (server-side stream)', 'Agent demo sandbox — QUALIFIER, FORGE, SHIPPER personas over SSE', 'purple'],
  ['MongoDB', 'All state, ledgers, and snapshots — replaces the v1 localStorage store', 'dim'],
];

export const WiringTab = ({ fly }) => {
  const c = fly?.config;
  return (
    <div className="space-y-4" data-testid="wiring-tab">
      <Panel className="p-5">
        <Eyebrow className="mb-3">Engine rules (live config)</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[11px]">
          {c && [
            ['On purchase', `${(c.buyback_pct * 100).toFixed(0)}% of fee → SOL → reserve`],
            ['On each cycle stage', `${(c.stage_tap_pct * 100).toFixed(2)}% of MRR → SOL → reserve (×8)`],
            ['Mining', `${c.hashrate_khs} kH/s · ${c.yield_per_khs_hour} ${c.mined_symbol}/kH/s/h`],
            ['Conversion', `every ${c.conversion_interval_min} min → mark-to-market → SOL`],
            ['Governor', `max ${c.hourly_capacity_sol} SOL injected per window · excess delayed`],
            ['Injection', `≥ ${c.min_injection_sol} SOL · constant-product curve · 1% pump fee · mode ${c.mode}`],
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
        <p className="text-[10px] text-dim2 mt-4 leading-relaxed">Safety envelope: the INJECTOR never holds keys and never broadcasts. Every buy is computed against the live curve state and ledgered as SIMULATED. Payments are demo captures. Flipping any of this to live execution is a Director decision, not a config flag.</p>
      </Panel>
    </div>
  );
};
