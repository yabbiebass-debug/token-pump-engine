import React from 'react';
import { ShoppingCart, RefreshCw, Pickaxe, ArrowLeftRight, Gauge, Syringe, Rocket } from 'lucide-react';
import { Eyebrow, Panel } from '@/components/kit/Primitives';
import { useFlywheel } from '@/hooks/useData';
import { sol, pct, countdown, compact } from '@/lib/format';

export const FlywheelExplainer = () => {
  const { data } = useFlywheel();
  const s = data?.state, d = data?.derived, c = data?.config;
  const steps = [
    { Icon: ShoppingCart, title: 'Purchase', tone: 'text-purple', body: `Every Fork, Merge, or Forge checkout routes ${c ? Math.round(c.buyback_pct * 100) : 15}% of the fee — converted to SOL at the live rate — into the buyback reserve.`, live: s ? `${sol(s.total_allocated_sol, 3)} allocated` : '' },
    { Icon: RefreshCw, title: 'Agent loop', tone: 'text-purple', body: 'All 8 stages (SCOUT → REINVEST) tap a slice of MRR into the reserve as they complete. REINVEST asks the governor for an injection.', live: s ? `${sol(s.total_tapped_sol, 3)} tapped` : '' },
    { Icon: Pickaxe, title: 'Hash mining', tone: 'text-amber', body: `A simulated ${c?.mined_symbol || 'XMR'} miner (${c?.hashrate_khs || 250} kH/s) accrues coins every second between conversions.`, live: d ? `${d.mined_balance_live.toFixed(6)} ${c.mined_symbol} pending` : '' },
    { Icon: ArrowLeftRight, title: 'Hourly conversion', tone: 'text-amber', body: 'At the top of every interval the mined balance is marked to market and swept into SOL. Nothing sits idle.', live: d ? `next in ${countdown(d.seconds_to_next_conversion)}` : '' },
    { Icon: Gauge, title: 'Capacity governor', tone: 'text-red', body: `Injections are capped per window (${c?.hourly_capacity_sol ?? 0.25} SOL). Once capacity is reached the pump is delayed to the next window — no wall of buys.`, live: d ? (d.governor_active ? 'DELAYING' : `${pct(d.window_usage_pct, 0)} used`) : '' },
    { Icon: Syringe, title: 'Inject', tone: 'text-green', body: 'The INJECTOR buys $BASH on the live pump.fun bonding-curve math (constant-product, 1% fee) and ledgers tokens, price impact, and curve progress.', live: s ? `${s.injections_count} buys · ${compact(s.total_tokens_acquired)} $BASH` : '' },
    { Icon: Rocket, title: 'Upstream', tone: 'text-green', body: 'When the curve fills to 85 SOL the token graduates to PumpSwap. Projected progress includes the simulated injections.', live: d ? `${pct(d.projected_curve_progress_pct, 3)} projected` : '' },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16" data-testid="flywheel-explainer">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <Eyebrow className="text-green">The flywheel</Eyebrow>
          <h2 className="font-display text-base md:text-lg font-black mt-1">Seven taps, one reserve, a paced pump</h2>
        </div>
        <div className="text-[10px] text-dim2 max-w-md">
          Mode: <span className="text-amber">{c?.mode || 'SIMULATED'}</span> — buys are computed against the live curve but never broadcast. Every step is ledgered in Mission Control.
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 stagger">
        {steps.map((st, i) => (
          <Panel key={st.title} className="p-4 hover:border-purple/60 transition-colors group" data-testid={`flywheel-step-${i + 1}`}>
            <div className="flex items-center justify-between mb-3">
              <st.Icon className={`h-4 w-4 ${st.tone}`} />
              <span className="text-[9px] text-dim2 font-mono">0{i + 1}</span>
            </div>
            <div className="font-display text-[12px] font-black mb-1.5">{st.title}</div>
            <p className="text-[10.5px] text-dim leading-relaxed">{st.body}</p>
            {st.live && <div className={`mt-3 text-[10px] font-mono ${st.tone} border-t border-line-subtle pt-2`}>{st.live}</div>}
          </Panel>
        ))}
      </div>
    </section>
  );
};
