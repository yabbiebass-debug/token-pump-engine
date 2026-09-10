import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { Panel, Tag, Eyebrow } from '@/components/kit/Primitives';
import { TokenImage } from '@/components/kit/TokenImage';
import { copyText } from '@/lib/clipboard';
import { tiny, usd, pct, short, timeAgo, compact } from '@/lib/format';

export const TokenHeader = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const t = data.token;
  if (!t) {
    return <Panel className="p-5 text-[11px] text-amber" data-testid="token-header-offline">Live token feed temporarily unavailable — engine continues on last known curve state.</Panel>;
  }
  const copy = async () => { if (await copyText(t.mint)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };
  const up = t.price_change_24h_pct >= 0;
  return (
    <Panel className="p-5 sm:p-6 scanline overflow-hidden" data-testid="token-header">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-green/10 blur-[90px]" />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-4 min-w-[280px]">
          <TokenImage src={t.image_uri} symbol={t.symbol} className="h-16 w-16" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-black">${t.symbol}</h1>
              <Tag tone="green"><span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" /> live</Tag>
              {t.complete ? <Tag tone="purple">Graduated</Tag> : <Tag tone="amber">Bonding curve</Tag>}
            </div>
            <div className="text-[11px] text-dim">{t.name}</div>
            <button onClick={copy} className="flex items-center gap-1.5 text-[10px] text-dim2 hover:text-ink mt-1" data-testid="token-copy-mint">
              {short(t.mint, 8, 6)} {copied ? <Check className="h-3 w-3 text-green" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 flex-1">
          {[
            ['Price (SOL)', tiny(t.price_sol), 'text-ink', `$${tiny(t.price_usd)}`],
            ['Market cap', usd(t.market_cap_usd), 'text-ink', `${t.market_cap_sol.toFixed(2)} SOL`],
            ['24h change', `${up ? '+' : ''}${pct(t.price_change_24h_pct)}`, up ? 'text-green' : 'text-red', `6h ${t.price_change_6h_pct >= 0 ? '+' : ''}${pct(t.price_change_6h_pct)}`],
            ['24h volume', usd(t.volume_24h_usd, 2), 'text-ink', `1h ${usd(t.volume_1h_usd, 2)}`],
            ['ATH mcap (est)', usd(t.ath_market_cap_usd), 'text-amber', `${compact(t.ath_market_cap_sol)} SOL`],
            ['Last trade', timeAgo(t.last_trade_at), 'text-dim', `SOL ${usd(t.sol_price_usd, 2)} · ${t.sol_price_source}`],
          ].map(([l, v, tone, sub]) => (
            <div key={l}>
              <Eyebrow className="!text-[8.5px]">{l}</Eyebrow>
              <div className={`font-display text-[15px] font-black ${tone}`}>{v}</div>
              <div className="text-[9.5px] text-dim2">{sub}</div>
            </div>
          ))}
        </div>

        <div className="flex lg:flex-col gap-2 text-[10px]">
          {[['pump.fun', t.pump_url, 'token-link-pump'], ['DexScreener', t.dex_url, 'token-link-dex'], ['Solscan', t.solscan_url, 'token-link-solscan']].map(([l, u, id]) => (
            <a key={l} href={u} target="_blank" rel="noreferrer" data-testid={id} className="flex items-center justify-between gap-2 border border-line-subtle rounded-sm px-2.5 py-1.5 text-dim hover:text-green hover:border-green/40 transition-colors">{l} <ExternalLink className="h-3 w-3" /></a>
          ))}
        </div>
      </div>
      <div className="relative mt-4 pt-3 border-t border-line-subtle flex flex-wrap gap-4 text-[9.5px] text-dim2">
        <span>Creator {short(t.creator || '')}</span>
        <span>Supply {compact(t.total_supply)}</span>
        <span>Sources: {t.sources.join(' · ')}</span>
        <span>Fetched {timeAgo(t.fetched_at)}</span>
        <span className="ml-auto text-green">Engine: LIVE · every buyback is Director-signed and verified on-chain</span>
      </div>
    </Panel>
  );
};
