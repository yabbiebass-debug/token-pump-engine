import React from 'react';
import { Rocket } from 'lucide-react';
import { Panel, Eyebrow, Tag } from '@/components/kit/Primitives';
import { sol, pct, compact } from '@/lib/format';

export const CurveProgress = ({ data }) => {
  const { derived: d, token: t, state: s } = data;
  const live = d.live_curve_progress_pct;
  const ours = d.treasury_curve_contribution_pct;
  return (
    <Panel className="p-5 space-y-4" data-testid="curve-progress">
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-1.5 text-amber"><Rocket className="h-3.5 w-3.5" /> Bonding curve → graduation (upstream)</Eyebrow>
        <Tag tone={t?.complete ? 'purple' : 'amber'}>{t?.complete ? 'Graduated to PumpSwap' : `${d.graduation_target_sol} SOL target`}</Tag>
      </div>
      <div className="relative h-6 w-full bg-panel3 rounded-sm overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-amber transition-[width] duration-700" style={{ width: `${Math.max(live, 0.4)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-green transition-[width] duration-700" style={{ width: `${Math.min(live, Math.max(ours, 0))}%` }} />
        <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-bold">
          <span className="text-ink">{pct(live, 3)} of curve filled · on-chain</span>
          <span className="text-green">{pct(ours, 3)} from treasury buybacks</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        {[
          ['Real SOL in curve', t ? sol(t.real_sol_reserves_sol, 4) : '—', 'text-amber'],
          ['Treasury buybacks', sol(s.total_injected_sol, 4), 'text-green'],
          ['Remaining to graduate', t ? sol(t.sol_remaining_to_graduate, 2) : '—', 'text-ink'],
          ['Tokens left on curve', t ? compact(t.real_token_reserves) : '—', 'text-ink'],
        ].map(([l, v, tone]) => <div key={l}><div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">{l}</div><div className={`font-display font-black text-[14px] ${tone}`}>{v}</div></div>)}
      </div>
      <p className="text-[10px] text-dim2 leading-relaxed">
        pump.fun completes the curve at ~{d.graduation_target_sol} SOL of real reserves, then migrates liquidity upstream to PumpSwap. Both bars are on-chain truth: amber is everyone's SOL in the curve, green is the slice the treasury bought through Director-signed transactions.
      </p>
    </Panel>
  );
};
