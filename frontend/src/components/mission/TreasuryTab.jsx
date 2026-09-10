import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Panel, Eyebrow, Tag } from '@/components/kit/Primitives';
import { TreasuryDispatch } from '@/components/mission/TreasuryDispatch';
import { TreasuryActivity } from '@/components/mission/TreasuryActivity';
import { usd, sol, short, dateTime, compact } from '@/lib/format';

const Card = ({ label, value, sub, tone = 'text-ink', testId, className = '' }) => (
  <Panel className={`p-4 ${className}`}><Eyebrow>{label}</Eyebrow><div className={`font-display text-[20px] font-black mt-1 ${tone}`} data-testid={testId}>{value}</div><div className="text-[10px] text-dim2">{sub}</div></Panel>
);

export const TreasuryTab = ({ payments, withdrawals, vault }) => {
  const v = vault || {};
  const solPrice = v.sol_price_usd || 100;
  return (
    <div className="space-y-4" data-testid="treasury-tab">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Treasury SOL · on-chain" value={v.balance_sol != null ? sol(v.balance_sol, 4) : '—'} sub={v.balance_sol != null ? `${usd(v.balance_usd, 2)} · slot ${v.slot}` : 'RPC unavailable'} tone="text-green" testId="vault-balance" className="border-green/40" />
        <Card label="Treasury $BASH · on-chain" value={v.token_balance != null ? compact(v.token_balance) : '—'} sub={v.token_balance != null ? `${sol(v.token_value_sol, 4)} · ${usd(v.token_value_usd, 2)}` : ''} tone="text-green" testId="vault-bash" />
        <Card label="Verified SOL payments" value={sol(v.deposited_sol || 0, 4)} sub={`${v.payments_count || 0} on-chain checkouts · ${usd(v.deposited_usd || 0)}`} testId="vault-deposited" />
        <Card label="Transfers out" value={sol(v.withdrawn_sol || 0, 4)} sub={`${v.withdrawals_count || 0} recorded`} testId="vault-withdrawn" />
        <Card label="Buyback reserve" value={sol(v.reserve_sol || 0, 4)} sub={v.reserve_backed ? 'backed by on-chain balance' : 'exceeds on-chain balance — fund the wallet'} tone={v.reserve_backed ? 'text-purple' : 'text-red'} testId="vault-reserve" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7"><TreasuryDispatch vault={vault} /></div>
        <div className="lg:col-span-5"><TreasuryActivity /></div>
      </div>

      <Panel className="p-5">
        <Eyebrow className="mb-3 flex items-center justify-between"><span>Recorded transfers</span><a href={v.solscan_url} target="_blank" rel="noreferrer" className="text-purple hover:underline flex items-center gap-1 normal-case tracking-normal">Treasury on Solscan <ExternalLink className="h-3 w-3" /></a></Eyebrow>
        <div className="space-y-1.5">
          {withdrawals.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px]" data-testid={`withdrawal-${w.id}`}>
              <div className="flex items-center gap-2"><Tag tone="green">on-chain</Tag><span className="font-bold">{sol(w.amount_sol)}</span><span className="text-dim2">≈ {usd(w.amount_usd_est)}</span></div>
              <div className="text-dim">{w.memo} · → {short(w.destination_wallet)}</div>
              <div className="flex items-center gap-2 text-dim2">
                <a href={`https://solscan.io/tx/${w.tx_signature}`} target="_blank" rel="noreferrer" className="text-green hover:underline flex items-center gap-1">{short(w.tx_signature, 8, 6)} <ExternalLink className="h-3 w-3" /></a>
                <span>{dateTime(w.created_at)}</span>
              </div>
            </div>
          ))}
          {withdrawals.length === 0 && <div className="text-[11px] text-dim">No transfers recorded yet.</div>}
        </div>
      </Panel>

      <Panel className="p-5">
        <Eyebrow className="mb-3">Verified payments</Eyebrow>
        <div className="space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px]" data-testid={`payment-${p.id}`}>
              <div className="flex items-center gap-2"><Tag tone="green">SOL · verified</Tag><span className="font-bold">{p.biz}</span><span className="text-dim">{p.package} · {p.tier}</span></div>
              <div className="flex items-center gap-3"><span className="text-green font-bold">{sol(p.sol_amount, 4)}</span><span className="text-dim2">{usd(p.amount_usd)} @ {usd(p.sol_price_usd || solPrice, 2)}</span>
                <a href={`https://solscan.io/tx/${p.tx_signature}`} target="_blank" rel="noreferrer" className="text-dim2 hover:text-green flex items-center gap-1">{short(p.tx_signature, 8, 6)} <ExternalLink className="h-3 w-3" /></a><span className="text-dim2">{dateTime(p.created_at)}</span></div>
            </div>
          ))}
          {payments.length === 0 && <div className="text-[11px] text-dim">No verified payments yet. Every checkout is a real SOL transfer confirmed on mainnet.</div>}
        </div>
      </Panel>
    </div>
  );
};
