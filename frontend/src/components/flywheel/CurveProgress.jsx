import React from 'react';
import { Rocket } from 'lucide-react';
import { Panel, Eyebrow, Tag } from '@/components/kit/Primitives';
import { sol, pct, compact } from '@/lib/format';

export const CurveProgress = ({ data }) => {
  const { derived: d, token: t, state: s } = data;
  const live = d.live_curve_progress_pct, proj = d.projected_curve_progress_pct;
  return (
    <Panel className="p-5 space-y-4" data-testid="curve-progress">
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-1.5 text-amber"><Rocket className="h-3.5 w-3.5" /> Bonding curve → graduation (upstream)</Eyebrow>
        <Tag tone={t?.complete ? 'purple' : 'amber'}>{t?.complete ? 'Graduated to PumpSwap' : `${d.graduation_target_sol} SOL target`}</Tag>
      </div>
      <div className="relative h-6 w-full bg-panel3 rounded-sm overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-green/30 transition-[width] duration-700" style={{ width: `${Math.max(proj, 0.8)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-amber transition-[width] duration-700" style={{ width: `${Math.max(live, 0.4)}%` }} />
        <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-bold">
          <span className="text-void mix-blend-screen">{pct(live, 3)} live</span>
          <span className="text-green">{pct(proj, 3)} with simulated injections</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        {[
          ['Real SOL in curve', t ? sol(t.real_sol_reserves_sol, 4) : '—', 'text-amber'],
          ['+ simulated', sol(s.total_injected_sol, 4), 'text-green'],
          ['Remaining to graduate', t ? sol(Math.max(0, d.graduation_target_sol - d.projected_real_sol), 2) : '—', 'text-ink'],
          ['Tokens left on curve', t ? compact(t.real_token_reserves) : '—', 'text-ink'],
        ].map(([l, v, tone]) => <div key={l}><div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">{l}</div><div className={`font-display font-black text-[14px] ${tone}`}>{v}</div></div>)}
      </div>
      <p className="text-[10px] text-dim2 leading-relaxed">
        pump.fun completes the curve at ~{d.graduation_target_sol} SOL of real reserves, then migrates liquidity upstream to PumpSwap. The amber bar is on-chain truth; the green overlay adds every simulated injection so you can see how far the flywheel <em>would</em> have carried it.
      </p>
    </Panel>
  );
};
