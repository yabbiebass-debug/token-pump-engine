import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Radar, Flame, ShieldCheck, Wallet } from 'lucide-react';
import { Btn, Tag, Panel, Eyebrow, Bar } from '@/components/kit/Primitives';
import { TokenImage } from '@/components/kit/TokenImage';
import { useFlywheel, useLiveStatus } from '@/hooks/useData';
import { tiny, usd, sol, compact, pct, timeAgo } from '@/lib/format';

const LiveTokenCard = () => {
  const { data, isLoading } = useFlywheel();
  const { data: liveSt } = useLiveStatus();
  if (isLoading || !data?.token) {
    return (
      <Panel className="p-5 min-h-[320px] flex items-center justify-center text-dim text-[11px]" data-testid="hero-token-card-loading">
        Syncing live $BASH curve…
      </Panel>
    );
  }
  const { token: t, state: s, derived: d, config: c } = data;
  const w = liveSt?.wallet;
  return (
    <Panel className="p-5 space-y-4 scanline animate-glow" data-testid="hero-token-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenImage src={t.image_uri} symbol={t.symbol} className="h-11 w-11" />
          <div>
            <div className="font-display text-[14px] font-black leading-tight">${t.symbol}</div>
            <div className="text-[10px] text-dim">{t.name}</div>
          </div>
        </div>
        <Tag tone="green"><span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" /> LIVE · {t.sources.join(' + ')}</Tag>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">Price</div>
          <div className="font-display text-[16px] font-black" data-testid="hero-token-price">{tiny(t.price_sol)} <span className="text-[10px] text-dim">SOL</span></div>
          <div className="text-[10px] text-dim2">${tiny(t.price_usd)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">Market cap</div>
          <div className="font-display text-[16px] font-black">{usd(t.market_cap_usd)}</div>
          <div className={`text-[10px] ${t.price_change_24h_pct >= 0 ? 'text-green' : 'text-red'}`}>{t.price_change_24h_pct >= 0 ? '+' : ''}{pct(t.price_change_24h_pct)} 24h</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-purple font-bold">Buyback reserve</div>
          <div className="font-display text-[16px] font-black text-purple" data-testid="hero-reserve">{sol(s.buyback_reserve_sol, 4)}</div>
          <div className="text-[10px] text-dim2">{usd(d.reserve_usd, 2)} earmarked</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-green font-bold">Bought on-chain</div>
          <div className="font-display text-[16px] font-black text-green" data-testid="hero-bought">{sol(s.total_injected_sol, 4)}</div>
          <div className="text-[10px] text-dim2">{compact(s.total_tokens_acquired)} $BASH · {s.injections_count} signed buys</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[9.5px] uppercase tracking-[1.5px]">
          <span className="text-dim">Curve → graduation</span>
          <span className="text-amber">{pct(t.curve_progress_pct, 3)} on-chain</span>
        </div>
        <Bar value={Math.max(0.6, t.curve_progress_pct)} tone="bg-amber" />
      </div>

      <div className="flex items-center justify-between text-[10px] text-dim2 border-t border-line-subtle pt-3">
        <span>Governor: {d.governor_active ? <span className="text-red">DELAYING (cap {c.hourly_capacity_sol} SOL/window hit)</span> : <span className="text-green">{pct(d.window_usage_pct, 0)} of window used</span>}</span>
        <span>Last buy {timeAgo(s.last_injection_at)}</span>
      </div>
      {w?.balance_sol != null && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] border border-green/30 bg-green/5 rounded-sm px-3 py-2" data-testid="hero-treasury-balances">
          <span className="text-dim uppercase tracking-[1.5px] text-[9px] font-bold">Treasury on-chain</span>
          <span className="text-green font-bold">{sol(w.balance_sol, 4)}</span>
          <span className="text-green font-bold">{compact(w.token_balance)} $BASH</span>
          <span className="text-green">LIVE · Director-signed</span>
        </div>
      )}
    </Panel>
  );
};

export const HeroSection = () => {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden" data-testid="hero-section">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-purple/20 blur-[140px]" />
      <div className="absolute top-20 right-0 h-[380px] w-[380px] rounded-full bg-green/10 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 pb-20 grid gap-12 lg:grid-cols-12 items-center">
        <div className="lg:col-span-7 space-y-7 stagger">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="green"><span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" /> Live operations</Tag>
            <Tag tone="purple">Open-source foundry</Tag>
            <Tag tone="green" data-testid="hero-mode-tag">$BASH flywheel · on-chain, Director-signed</Tag>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.02] tracking-tight">
            Every build ships a product.
            <br />
            <span className="text-purple">Every SOL paid</span> feeds <span className="text-green">the token.</span>
          </h1>
          <p className="text-base text-dim leading-relaxed max-w-2xl">
            YabbAI Forge forks, merges, and forges open-source tools for any niche. Builds are paid in SOL and verified on Solana mainnet; a fixed share of every payment is earmarked in the <span className="text-ink">$BASH buyback reserve</span>. A capacity governor paces releases, the Director signs each buy from the disclosed treasury wallet, and every transaction is public.
          </p>
          <div className="flex flex-wrap gap-3">
            <Btn variant="green" onClick={() => navigate('/pricing')} data-testid="hero-cta-start-build">Start a build <ArrowRight className="h-3.5 w-3.5" /></Btn>
            <Btn variant="primary" onClick={() => navigate('/flywheel')} data-testid="hero-cta-flywheel">Watch the flywheel</Btn>
            <Btn variant="ghost" onClick={() => navigate('/transparency')} data-testid="hero-cta-mission">Public ledger</Btn>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-line-subtle">
            {[
              [Radar, '3–5 days', 'Fastest ship (Fork)'],
              [Flame, '15%', 'Of every payment → buyback'],
              [Wallet, 'SOL only', 'Verified on mainnet'],
              [ShieldCheck, '1 wallet', 'Director-signed, public'],
            ].map(([Icon, v, l]) => (
              <div key={l} className="flex items-start gap-2.5">
                <Icon className="h-4 w-4 text-purple mt-1 shrink-0" />
                <div>
                  <div className="font-display text-[15px] font-black">{v}</div>
                  <div className="text-[10px] text-dim2">{l}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 animate-fade-up [animation-delay:200ms]">
          <Eyebrow className="mb-2 text-green">Token feed · pump.fun bonding curve</Eyebrow>
          <LiveTokenCard />
        </div>
      </div>
    </section>
  );
};
