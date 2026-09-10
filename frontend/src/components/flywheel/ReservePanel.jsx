import React, { useState } from 'react';
import { toast } from 'sonner';
import { Syringe, ArrowLeftRight, FastForward } from 'lucide-react';
import { Panel, Eyebrow, Btn, Bar } from '@/components/kit/Primitives';
import { injectNow, convertNow, fastForward, errMsg } from '@/lib/api';
import { useRefresh } from '@/hooks/useData';
import { sol, usd, compact, pct } from '@/lib/format';

const describe = (inj) => {
  if (!inj) return '';
  if (inj.status === 'injected') return `Injected ${sol(inj.amount_sol)} → ${compact(inj.tokens_acquired)} $BASH (+${inj.impact_pct.toFixed(2)}%)`;
  if (inj.status === 'delayed') return `Governor delayed ${sol(inj.amount_sol, 3)} — cap reached`;
  return `Reserve ${sol(inj.reserve_sol, 4)} below minimum ${inj.min_injection_sol} SOL`;
};

export const ReservePanel = ({ data }) => {
  const refresh = useRefresh();
  const [busy, setBusy] = useState('');
  const { state: s, derived: d, config: c } = data;
  const inflow = Math.max(d.total_inflow_sol, 1e-12);
  const rows = [
    ['Purchase allocations', s.total_allocated_sol, 'bg-purple'],
    ['Cycle stage taps', s.total_tapped_sol, 'bg-panel3'],
    ['Mining conversions', s.total_converted_sol, 'bg-amber'],
  ];

  const act = async (key, fn, label) => {
    setBusy(key);
    try {
      const r = await fn();
      refresh();
      const inj = r.injection || r;
      toast.success(`${label}: ${describe(inj)}`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <Panel className="p-5 space-y-5" data-testid="reserve-panel">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow className="text-purple">Buyback reserve</Eyebrow>
          <div className="font-display text-3xl font-black text-purple" data-testid="reserve-sol">{sol(s.buyback_reserve_sol, 4)}</div>
          <div className="text-[10.5px] text-dim">{usd(d.reserve_usd, 2)} waiting for the governor window</div>
        </div>
        <div className="text-right">
          <Eyebrow>Total inflow</Eyebrow>
          <div className="font-display text-[15px] font-black">{sol(d.total_inflow_sol, 3)}</div>
          <div className="text-[10px] text-dim2">{sol(s.total_injected_sol, 3)} deployed</div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(([l, v, tone]) => (
          <div key={l}>
            <div className="flex justify-between text-[10px] mb-1"><span className="text-dim">{l}</span><span className="text-ink">{sol(v, 4)} · {pct((v / inflow) * 100, 1)}</span></div>
            <Bar value={(v / inflow) * 100} tone={tone} />
          </div>
        ))}
      </div>

      <div className="border border-green/30 bg-green/5 rounded-sm p-3 grid grid-cols-3 gap-3 text-[11px]" data-testid="sim-position">
        <div><div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Sim. position</div><div className="font-display font-black text-[14px]">{compact(s.total_tokens_acquired)}</div><div className="text-[9.5px] text-dim2">$BASH · {pct(d.position_supply_pct, 3)} of supply</div></div>
        <div><div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Mark value</div><div className="font-display font-black text-[14px]">{sol(d.position_value_sol, 4)}</div><div className="text-[9.5px] text-dim2">{usd(d.position_value_usd, 2)} at live price</div></div>
        <div><div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Cost basis</div><div className="font-display font-black text-[14px]">{sol(s.total_injected_sol, 4)}</div><div className="text-[9.5px] text-dim2">{s.injections_count} injections · {s.delays_count} delays</div></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Btn variant="green" disabled={!!busy} onClick={() => act('inject', injectNow, 'Manual injection')} data-testid="inject-now-btn"><Syringe className="h-3.5 w-3.5" /> Inject</Btn>
        <Btn variant="amber" disabled={!!busy} onClick={() => act('convert', convertNow, 'Conversion')} data-testid="convert-now-btn"><ArrowLeftRight className="h-3.5 w-3.5" /> Convert</Btn>
        <Btn variant="ghost" disabled={!!busy} onClick={() => act('ff', fastForward, 'Fast-forward 1h')} data-testid="fast-forward-btn"><FastForward className="h-3.5 w-3.5" /> +1 hour</Btn>
      </div>
      <p className="text-[9.5px] text-dim2 leading-relaxed">Inject asks the governor for capacity now. Convert marks the mined {c.mined_symbol} to market immediately. +1 hour simulates an hour of hashing, converts, and opens a fresh governor window — handy for demos.</p>
    </Panel>
  );
};
