import React from 'react';
import { useFlywheel } from '@/hooks/useData';
import { tiny, usd, compact, pct, sol } from '@/lib/format';

export const TokenTicker = () => {
  const { data } = useFlywheel();
  if (!data?.token) return null;
  const t = data.token;
  const d = data.derived;
  const s = data.state;
  const items = [
    ['$' + t.symbol, `${tiny(t.price_sol)} SOL`, 'text-ink'],
    ['USD', `$${tiny(t.price_usd)}`, 'text-ink'],
    ['MCAP', usd(t.market_cap_usd), 'text-ink'],
    ['24H', `${t.price_change_24h_pct >= 0 ? '+' : ''}${pct(t.price_change_24h_pct, 2)}`, t.price_change_24h_pct >= 0 ? 'text-green' : 'text-red'],
    ['VOL 24H', usd(t.volume_24h_usd, 2), 'text-ink'],
    ['CURVE', `${pct(t.curve_progress_pct, 3)} → graduation`, 'text-amber'],
    ['SOL', usd(t.sol_price_usd, 2), 'text-ink'],
    ['RESERVE', sol(s.buyback_reserve_sol, 3), 'text-purple'],
    ['SIM INJECTED', sol(s.total_injected_sol, 3), 'text-green'],
    ['SIM POSITION', `${compact(s.total_tokens_acquired)} $BASH`, 'text-green'],
    ['GOVERNOR', d.governor_active ? 'DELAYING · CAP HIT' : `${pct(d.window_usage_pct, 0)} of window`, d.governor_active ? 'text-red' : 'text-dim'],
    ['MODE', data.config.mode, 'text-amber'],
  ];
  const row = (k) => (
    <div key={k} className="flex shrink-0 items-center gap-8 pr-8">
      {items.map(([label, val, tone], i) => (
        <span key={i} className="flex items-center gap-2 text-[10px] font-mono whitespace-nowrap">
          <span className="text-dim2 uppercase tracking-[1.5px]">{label}</span>
          <span className={tone}>{val}</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="border-b border-line-subtle bg-panel/70 overflow-hidden" data-testid="token-ticker">
      <div className="flex w-max animate-ticker py-1.5 hover:[animation-play-state:paused]">{row('a')}{row('b')}</div>
    </div>
  );
};
