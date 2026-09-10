import React from 'react';
import { Gauge, Clock, Pickaxe } from 'lucide-react';
import { Panel, Eyebrow, Tag, Bar } from '@/components/kit/Primitives';
import { sol, pct, countdown, hhmm, usd, timeAgo } from '@/lib/format';

export const GovernorPanel = ({ data }) => {
  const { state: s, derived: d, config: c } = data;
  return (
    <Panel className={`p-5 space-y-4 ${d.governor_active ? 'border-red/50' : ''}`} data-testid="governor-panel">
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> Capacity governor</Eyebrow>
        <Tag tone={d.governor_active ? 'red' : 'green'} data-testid="governor-status">{d.governor_active ? 'Delaying · cap reached' : 'Capacity available'}</Tag>
      </div>
      <div>
        <div className="flex justify-between text-[10px] mb-1"><span className="text-dim">Injected this window</span><span className="text-ink">{sol(d.window_injected_sol, 4)} / {c.hourly_capacity_sol} SOL</span></div>
        <Bar value={d.window_usage_pct} tone={d.governor_active ? 'bg-red' : 'bg-green'} className="h-2.5" />
        <div className="flex justify-between text-[9.5px] text-dim2 mt-1"><span>Window {hhmm(d.window_start)} → {hhmm(d.window_end)} UTC-local</span><span>{sol(d.window_cap_left_sol, 4)} left</span></div>
      </div>
      {d.governor_active && (
        <div className="border border-red/40 bg-red/10 rounded-sm p-3 text-[11px] text-red" data-testid="governor-delay-notice">
          Reserve holds {sol(s.buyback_reserve_sol, 4)} but the window is saturated. The pump resumes at {hhmm(s.last_delay_resumes_at || d.window_end)} — no wall of buys, no spike.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div className="border border-line-subtle rounded-sm p-3">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[1.5px] text-amber font-bold"><Clock className="h-3 w-3" /> Next conversion</div>
          <div className="font-display font-black text-[15px] mt-1" data-testid="next-conversion">{countdown(d.seconds_to_next_conversion)}</div>
          <div className="text-[9.5px] text-dim2">at {hhmm(d.next_conversion_at)} · every {c.conversion_interval_min} min</div>
        </div>
        <div className="border border-line-subtle rounded-sm p-3">
          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[1.5px] text-amber font-bold"><Pickaxe className="h-3 w-3" /> Mined · pending</div>
          <div className="font-display font-black text-[15px] mt-1" data-testid="mined-pending">{d.mined_balance_live.toFixed(6)} <span className="text-[10px] text-dim">{c.mined_symbol}</span></div>
          <div className="text-[9.5px] text-dim2">{usd(d.mined_balance_usd, 3)} · {c.mined_symbol} {usd(d.mined_price_usd, 2)} ({d.mined_price_source})</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div className="border border-line-subtle rounded-sm py-2"><div className="font-display font-black text-[14px]">{s.injections_count}</div><div className="text-dim2">injections</div></div>
        <div className="border border-line-subtle rounded-sm py-2"><div className="font-display font-black text-[14px] text-red">{s.delays_count}</div><div className="text-dim2">delays</div></div>
        <div className="border border-line-subtle rounded-sm py-2"><div className="font-display font-black text-[14px]">{s.conversions_count}</div><div className="text-dim2">conversions</div></div>
      </div>
      <div className="text-[9.5px] text-dim2">Last injection {timeAgo(s.last_injection_at)} · hashrate {c.hashrate_khs} kH/s ≈ {sol(d.mined_per_hour_sol, 5)}/h ({pct((d.mined_per_hour_sol / Math.max(c.hourly_capacity_sol, 1e-9)) * 100, 1)} of cap)</div>
    </Panel>
  );
};
