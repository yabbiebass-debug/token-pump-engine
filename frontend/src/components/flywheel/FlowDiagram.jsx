import React from 'react';
import { ShoppingCart, Pickaxe, Vault, Gauge, FileSignature, ShieldCheck, Rocket } from 'lucide-react';
import { Panel, Eyebrow } from '@/components/kit/Primitives';
import { useMining } from '@/hooks/useData';
import { sol, pct, compact } from '@/lib/format';

const Arrow = ({ hot }) => (
  <svg className="hidden xl:block h-6 w-10 shrink-0 self-center" viewBox="0 0 40 24">
    <line x1="2" y1="12" x2="30" y2="12" stroke={hot ? '#14f195' : '#626c82'} strokeWidth="1.5" strokeDasharray="4 4" className={hot ? 'animate-flow' : ''} />
    <path d="M28 7 L36 12 L28 17" fill="none" stroke={hot ? '#14f195' : '#626c82'} strokeWidth="1.5" />
  </svg>
);

export const FlowDiagram = ({ data }) => {
  const { state: s, derived: d, config: c, live } = data;
  const { data: m } = useMining();
  const intent = live?.pending_intent;
  const nodes = [
    { Icon: ShoppingCart, name: 'SOL payments', tone: 'text-purple', border: 'border-purple/40', v: sol(s.total_allocated_sol, 4), sub: `${Math.round(c.buyback_pct * 100)}% of each verified payment`, id: 'purchases' },
    { Icon: Pickaxe, name: 'Hash mining', tone: 'text-amber', border: 'border-amber/40', v: m ? sol(m.pending_sol, 5) : '…', sub: m ? `${m.workers_online} worker(s) · unMineable → SOL · ${sol(s.total_mining_sol || 0, 4)} earmarked` : 'reading pool', id: 'mining', live: !!m?.workers_online },
    { Icon: Vault, name: 'Reserve', tone: 'text-ink', border: 'border-line', v: sol(s.buyback_reserve_sol, 4), sub: `≈ $${d.reserve_usd.toFixed(2)} earmarked`, id: 'reserve', hot: true },
    { Icon: Gauge, name: 'Governor', tone: d.governor_active ? 'text-red' : 'text-green', border: d.governor_active ? 'border-red/50' : 'border-green/40', v: d.governor_active ? 'DELAYING' : `${pct(d.window_usage_pct, 0)} used`, sub: `${d.window_injected_sol.toFixed(4)} / ${c.hourly_capacity_sol} SOL per ${c.window_min} min`, id: 'governor' },
    { Icon: FileSignature, name: 'Director signs', tone: intent ? 'text-amber' : 'text-dim', border: intent ? 'border-amber/50' : 'border-line-subtle', v: intent ? sol(intent.amount_sol, 4) : 'idle', sub: intent ? 'release awaiting wallet signature' : 'no release pending', id: 'sign', live: !!intent },
    { Icon: ShieldCheck, name: 'Verified buys', tone: 'text-green', border: 'border-green/40', v: sol(s.total_injected_sol, 4), sub: `${s.injections_count} tx · ${compact(s.total_tokens_acquired)} $BASH`, id: 'inject' },
    { Icon: Rocket, name: 'Upstream', tone: 'text-green', border: 'border-green/40', v: pct(d.live_curve_progress_pct, 3), sub: `curve → ${d.graduation_target_sol} SOL graduation`, id: 'upstream' },
  ];
  return (
    <Panel className="p-5" data-testid="flow-diagram">
      <Eyebrow className="mb-4 flex items-center justify-between"><span>Pipeline · real funds only</span><span className="text-[9px] text-dim2 normal-case tracking-normal">Every node is backed by an on-chain transaction or a governor decision.</span></Eyebrow>
      <div className="flex flex-col xl:flex-row gap-2 xl:gap-0 stagger">
        {nodes.map((n, i) => (
          <React.Fragment key={n.id}>
            <div className={`flex-1 border ${n.border} bg-void/60 rounded-sm p-3 min-w-0 ${n.hot ? 'animate-glow' : ''}`} data-testid={`flow-node-${n.id}`}>
              <div className="flex items-center justify-between mb-2"><n.Icon className={`h-4 w-4 ${n.tone}`} />{n.live && <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse" />}</div>
              <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">{n.name}</div>
              <div className={`font-display text-[11.5px] font-black truncate ${n.tone}`} title={n.v}>{n.v}</div>
              <div className="text-[9.5px] text-dim2 truncate" title={n.sub}>{n.sub}</div>
            </div>
            {i < nodes.length - 1 && <Arrow hot={i >= 1} />}
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
};
