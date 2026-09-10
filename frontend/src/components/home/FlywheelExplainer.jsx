import React from 'react';
import { ShoppingCart, Vault, Gauge, FileSignature, ShieldCheck, Rocket } from 'lucide-react';
import { Eyebrow, Panel } from '@/components/kit/Primitives';
import { useFlywheel } from '@/hooks/useData';
import { sol, pct, compact, countdown } from '@/lib/format';

export const FlywheelExplainer = () => {
  const { data } = useFlywheel();
  const s = data?.state, d = data?.derived, c = data?.config, intent = data?.live?.pending_intent;
  const steps = [
    { Icon: ShoppingCart, title: 'SOL payment', tone: 'text-purple', body: 'Every Fork, Merge, or Forge build is paid in SOL to the disclosed treasury wallet. The backend reads the transfer back from mainnet and accepts it only if ≥ 97% of the quote arrived.', live: s ? `${sol(s.total_allocated_sol, 4)} earmarked` : '' },
    { Icon: Vault, title: 'Reserve', tone: 'text-purple', body: `${c ? Math.round(c.buyback_pct * 100) : 15}% of each verified payment is earmarked for buybacks. The reserve is an accounting line on the real balance — never a separate pot.`, live: s ? `${sol(s.buyback_reserve_sol, 4)} in reserve` : '' },
    { Icon: Gauge, title: 'Capacity governor', tone: 'text-red', body: `Releases are capped per window (${c?.hourly_capacity_sol ?? 0.25} SOL / ${c?.window_min ?? 60} min). Once the cap is hit the next release waits for the next window — no wall of buys.`, live: d ? (d.governor_active ? 'DELAYING' : `${pct(d.window_usage_pct, 0)} used · closes in ${countdown(d.seconds_to_window_end)}`) : '' },
    { Icon: FileSignature, title: 'Director signs', tone: 'text-amber', body: 'A released amount becomes a Jupiter-built pump.fun buy that the Director signs in-browser from the treasury wallet. The server never holds a key.', live: intent ? `${sol(intent.amount_sol, 4)} awaiting signature` : 'nothing pending' },
    { Icon: ShieldCheck, title: 'Verified & ledgered', tone: 'text-green', body: 'The backend reads the transaction, checks the SOL and $BASH deltas of the treasury wallet, then ledgers it with the Solscan link and fires the Telegram alert.', live: s ? `${s.injections_count} buys · ${compact(s.total_tokens_acquired)} $BASH` : '' },
    { Icon: Rocket, title: 'Upstream', tone: 'text-green', body: 'When the curve fills to 85 SOL the token graduates to PumpSwap. Progress shown is on-chain only.', live: d ? `${pct(d.live_curve_progress_pct, 3)} on-chain` : '' },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16" data-testid="flywheel-explainer">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <Eyebrow className="text-green">The flywheel</Eyebrow>
          <h2 className="font-display text-base md:text-lg font-black mt-1">Real SOL in, paced buybacks out, every step on-chain</h2>
        </div>
        <div className="text-[10px] text-dim2 max-w-md">
          No simulation, no demo gateways. One disclosed wallet, a public ledger, a per-window cap, and a human signature on every buy.
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 stagger">
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
