import React from 'react';
import { Pickaxe, ExternalLink, Cpu, Wifi, WifiOff } from 'lucide-react';
import { Panel, Eyebrow, Tag, Bar } from '@/components/kit/Primitives';
import { useMining } from '@/hooks/useData';
import { sol, usd, short, dateTime, timeAgo } from '@/lib/format';

export const fmtHash = (hs) => {
  const v = Number(hs || 0);
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GH/s`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MH/s`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kH/s`;
  return `${v.toFixed(0)} H/s`;
};

export const MiningPanel = () => {
  const { data: m } = useMining();
  if (!m) return <Panel className="p-5 text-[11px] text-dim" data-testid="mining-loading">Reading unMineable account…</Panel>;
  const rewarded = m.rewarded || {};
  return (
    <Panel className="p-5 space-y-4 border-amber/30" data-testid="mining-panel">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow className="flex items-center gap-1.5 text-amber"><Pickaxe className="h-3.5 w-3.5" /> Hash mining → SOL · unMineable</Eyebrow>
        <Tag tone={m.ok ? (m.workers_online ? 'green' : 'amber') : 'red'} data-testid="mining-status-tag">{!m.ok ? 'Pool API offline' : m.workers_online ? `${m.workers_online} worker(s) hashing` : 'No workers connected'}</Tag>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">Mined · pending at pool</div>
          <div className="font-display text-[18px] font-black text-amber" data-testid="mining-pending">{sol(m.pending_sol, 5)}</div>
          <div className="text-[9.5px] text-dim2">{usd(m.pending_usd, 3)} · already converted to SOL by the pool</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">Paid out on-chain</div>
          <div className="font-display text-[18px] font-black text-green" data-testid="mining-paid">{sol(m.payouts_total_sol, 4)}</div>
          <div className="text-[9.5px] text-dim2">{m.payouts_onchain.length} payout tx · {sol(m.allocated_total_sol, 4)} → reserve ({Math.round(m.share_pct * 100)}%)</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] mb-1"><span className="text-dim">Payout threshold</span><span className="text-ink">{sol(m.pending_sol, 5)} / {m.payment_threshold_sol} SOL</span></div>
        <Bar value={m.threshold_pct} tone="bg-amber" />
        <div className="text-[9.5px] text-dim2 mt-1">unMineable converts every share to SOL as you mine and sends it to the treasury once the balance reaches {m.payment_threshold_sol} SOL (fee {m.pool_fee_pct}%). Each payout is indexed on-chain and earmarked automatically.</div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        {[['24h', rewarded.past_24h], ['7d', rewarded.past_7d], ['30d', rewarded.past_30d]].map(([l, v]) => (
          <div key={l} className="border border-line-subtle rounded-sm py-2"><div className="font-display font-black text-[13px]">{Number(v || 0).toFixed(5)}</div><div className="text-dim2">SOL mined · {l}</div></div>
        ))}
      </div>

      <div className="space-y-1.5" data-testid="mining-workers">
        <Eyebrow className="flex items-center gap-1.5"><Cpu className="h-3 w-3" /> Workers</Eyebrow>
        {m.workers.length === 0 && <div className="text-[10.5px] text-dim border border-dashed border-line-subtle rounded-sm p-3">No rig is pointed at this address yet. Generate the command in the rig setup panel, run it on your machine or rented rig, and this list lights up within a minute.</div>}
        {m.workers.map((w) => (
          <div key={`${w.algo}-${w.name}`} className="flex items-center justify-between text-[10.5px] border border-line-subtle rounded-sm px-2.5 py-1.5" data-testid={`mining-worker-${w.name}`}>
            <span className="flex items-center gap-1.5">{w.online ? <Wifi className="h-3 w-3 text-green" /> : <WifiOff className="h-3 w-3 text-red" />}<span className="font-bold">{w.name}</span><span className="text-dim2">{w.algo}</span></span>
            <span className="text-ink">{fmtHash(w.calculated_hs || w.reported_hs)}<span className="text-dim2 ml-2">{w.last_seen ? timeAgo(w.last_seen) : ''}</span></span>
          </div>
        ))}
      </div>

      {m.payouts_onchain.length > 0 && (
        <div className="space-y-1.5" data-testid="mining-payouts">
          <Eyebrow>Payouts landed in treasury</Eyebrow>
          {m.payouts_onchain.slice(0, 5).map((p) => (
            <a key={p.signature} href={`https://solscan.io/tx/${p.signature}`} target="_blank" rel="noreferrer" className="flex items-center justify-between text-[10px] border border-line-subtle rounded-sm px-2.5 py-1.5 hover:border-amber/50">
              <span className="text-amber font-bold">+{sol(p.sol_delta, 5)}</span>
              <span className="text-dim2 flex items-center gap-1">{short(p.signature, 8, 6)} · {dateTime(p.created_at)} <ExternalLink className="h-3 w-3" /></span>
            </a>
          ))}
        </div>
      )}
      <a href={m.dashboard_url} target="_blank" rel="noreferrer" className="text-[10px] text-amber hover:underline flex items-center gap-1" data-testid="mining-dashboard-link">unMineable dashboard for {short(m.address)} <ExternalLink className="h-3 w-3" /></a>
    </Panel>
  );
};
