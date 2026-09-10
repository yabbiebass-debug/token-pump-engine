import React from 'react';
import { Panel, Eyebrow, Bar, Tag } from '@/components/kit/Primitives';
import { useLiveStatus } from '@/hooks/useData';
import { sol, usd, compact, pct } from '@/lib/format';

export const ReservePanel = ({ data }) => {
  const { data: live } = useLiveStatus();
  const { state: s, derived: d, config: c } = data;
  const bal = live?.wallet?.balance_sol;
  const backed = bal == null || bal >= s.buyback_reserve_sol;
  const deployedPct = d.total_inflow_sol > 0 ? (s.total_injected_sol / d.total_inflow_sol) * 100 : 0;
  return (
    <Panel className="p-5 space-y-5" data-testid="reserve-panel">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow className="text-purple">Buyback reserve</Eyebrow>
          <div className="font-display text-3xl font-black text-purple" data-testid="reserve-sol">{sol(s.buyback_reserve_sol, 4)}</div>
          <div className="text-[10.5px] text-dim">{usd(d.reserve_usd, 2)} · {Math.round(c.buyback_pct * 100)}% of every verified SOL payment</div>
        </div>
        <Tag tone={backed ? 'green' : 'red'} data-testid="reserve-backed-tag">{backed ? 'Backed on-chain' : 'Unbacked · fund wallet'}</Tag>
      </div>

      <div>
        <div className="flex justify-between text-[10px] mb-1"><span className="text-dim">Deployed into $BASH</span><span className="text-ink">{sol(s.total_injected_sol, 4)} of {sol(d.total_inflow_sol, 4)} · {pct(deployedPct, 1)}</span></div>
        <Bar value={deployedPct} tone="bg-green" />
      </div>

      <div className="border border-green/30 bg-green/5 rounded-sm p-3 grid grid-cols-3 gap-3 text-[11px]" data-testid="position">
        <div><div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Bought on-chain</div><div className="font-display font-black text-[14px]">{compact(s.total_tokens_acquired)}</div><div className="text-[9.5px] text-dim2">$BASH · {pct(d.position_supply_pct, 3)} of supply</div></div>
        <div><div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Mark value</div><div className="font-display font-black text-[14px]">{sol(d.position_value_sol, 4)}</div><div className="text-[9.5px] text-dim2">{usd(d.position_value_usd, 2)} at live price</div></div>
        <div><div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Cost basis</div><div className="font-display font-black text-[14px]">{sol(s.total_injected_sol, 4)}</div><div className="text-[9.5px] text-dim2">{s.injections_count} buys · {s.delays_count} delays</div></div>
      </div>

      <p className="text-[9.5px] text-dim2 leading-relaxed">The reserve is an earmark on the real treasury balance, not a separate pot. When the governor releases it, the Director signs the buy in the panel above; nothing moves without that signature.</p>
    </Panel>
  );
};
