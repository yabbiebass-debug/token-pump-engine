import React, { useState } from 'react';
import { Download, Link as LinkIcon, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Panel, Eyebrow, Tag, Btn } from '@/components/kit/Primitives';
import { useFlywheel, useLedger, useLiveStatus } from '@/hooks/useData';
import { ledgerCsvUrl } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { LEDGER_TONE } from '@/lib/constants';
import { ledgerDetail } from '@/components/flywheel/LedgerTable';
import { sol, usd, compact, pct, dateTime, tiny } from '@/lib/format';

const FILTERS = [['all', 'Everything'], ['injection', 'On-chain buybacks'], ['delayed', 'Governor delays'], ['allocation', 'Payment allocations']];

export default function TransparencyPage() {
  const { data } = useFlywheel();
  const { data: ledger } = useLedger(500);
  const { data: liveSt } = useLiveStatus();
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const rows = (ledger || []).filter((e) => filter === 'all' || e.type === filter);

  const share = async () => {
    const ok = await copyText(window.location.href);
    if (!ok) return toast.error('Copy blocked by the browser — copy the URL from the address bar');
    setCopied(true);
    toast('Link copied');
    setTimeout(() => setCopied(false), 1500);
  };

  if (!data) return <div className="mx-auto max-w-7xl px-6 py-20 text-dim text-[12px]" data-testid="transparency-loading">Loading public ledger…</div>;
  const { state: s, derived: d, config: c, token: t } = data;
  const w = liveSt?.wallet;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 space-y-8" data-testid="transparency-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3 max-w-2xl">
          <Eyebrow className="text-green flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Public · read-only · on-chain</Eyebrow>
          <h1 className="font-display text-4xl sm:text-5xl font-black leading-tight">$BASH treasury <span className="text-green">transparency.</span></h1>
          <p className="text-dim text-sm leading-relaxed">
            Every verified SOL payment, every governor decision, and every Director-signed buyback — in the order it happened, each with its Solana transaction. {Math.round(c.buyback_pct * 100)}% of each payment is earmarked for buybacks; the governor caps them at {c.hourly_capacity_sol} SOL per {c.window_min}-minute window. Nothing here is simulated.
          </p>
          <div className="flex flex-wrap gap-2">
            <Tag tone="green" data-testid="transparency-mode-tag">LIVE — Director-signed buybacks from {c.signer_wallet.slice(0, 6)}…{c.signer_wallet.slice(-4)}</Tag>
            {t && <Tag tone="green">${t.symbol} {tiny(t.price_sol)} SOL</Tag>}
          </div>
          {w?.balance_sol != null && (
            <div className="flex flex-wrap gap-4 text-[11px] border border-line-subtle bg-panel/60 rounded-sm px-3 py-2" data-testid="transparency-treasury">
              <span className="text-dim">Treasury on-chain</span>
              <span className="text-green font-bold">{sol(w.balance_sol, 4)}</span>
              <span className="text-green font-bold">{compact(w.token_balance)} $BASH</span>
              <span className="text-dim2">{usd(w.token_value_usd + w.balance_usd, 2)} total</span>
              <a href={w.solscan_url} target="_blank" rel="noreferrer" className="text-dim hover:text-ink flex items-center gap-1">{liveSt.signer_wallet.slice(0, 6)}…{liveSt.signer_wallet.slice(-4)} <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={share} data-testid="transparency-share-btn">{copied ? <Check className="h-3.5 w-3.5 text-green" /> : <LinkIcon className="h-3.5 w-3.5" />} Share link</Btn>
          <a href={ledgerCsvUrl(filter)} data-testid="transparency-csv-btn" className="inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-[10.5px] font-bold uppercase tracking-[1.5px] bg-green text-void hover:bg-green-hover transition-colors"><Download className="h-3.5 w-3.5" /> Export CSV</a>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8 stagger" data-testid="transparency-totals">
        {[
          ['Bought on-chain', sol(s.total_injected_sol, 4), 'text-green', usd(d.total_injected_usd, 2)],
          ['$BASH acquired', compact(s.total_tokens_acquired), 'text-green', `${pct(d.position_supply_pct, 3)} of supply`],
          ['Treasury SOL', w?.balance_sol != null ? sol(w.balance_sol, 4) : '—', 'text-ink', 'live from mainnet'],
          ['Treasury $BASH', w?.token_balance != null ? compact(w.token_balance) : '—', 'text-ink', w ? usd(w.token_value_usd, 2) : ''],
          ['Buybacks', s.injections_count, 'text-ink', 'signed transactions'],
          ['Delays', s.delays_count, 'text-red', 'governor holds'],
          ['Reserve', sol(s.buyback_reserve_sol, 4), 'text-purple', usd(d.reserve_usd, 2)],
          ['Curve', pct(d.live_curve_progress_pct, 3), 'text-amber', `${pct(d.treasury_curve_contribution_pct, 3)} from treasury`],
        ].map(([l, v, tone, sub]) => (
          <Panel key={l} className="p-3">
            <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">{l}</div>
            <div className={`font-display text-[15px] font-black ${tone}`}>{v}</div>
            <div className="text-[9.5px] text-dim2 truncate">{sub}</div>
          </Panel>
        ))}
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <Eyebrow>Ledger · {rows.length} records</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} data-testid={`transparency-filter-${k}`} className={`px-2.5 py-1 rounded-sm text-[9.5px] uppercase tracking-[1.5px] border ${filter === k ? 'border-green text-ink bg-green/10' : 'border-line-subtle text-dim hover:text-ink'}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10.5px]">
            <thead><tr className="text-left text-[9px] uppercase tracking-[1.5px] text-dim border-b border-line-subtle"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">SOL</th><th className="py-2 pr-3">USD</th><th className="py-2">Detail</th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const tone = LEDGER_TONE[e.type] || LEDGER_TONE.other;
                return (
                  <tr key={e.id} className="border-b border-line-subtle/60 hover:bg-panel2/60" data-testid={`transparency-row-${e.id}`}>
                    <td className="py-2 pr-3 text-dim2 whitespace-nowrap">{dateTime(e.created_at)}</td>
                    <td className="py-2 pr-3"><span className={`text-[8.5px] uppercase tracking-[1.5px] px-1.5 py-0.5 rounded border font-bold ${tone.cls}`}>{tone.label}</span></td>
                    <td className={`py-2 pr-3 font-display font-black whitespace-nowrap ${e.type === 'delayed' ? 'text-red' : e.type === 'injection' ? 'text-green' : 'text-ink'}`}>{sol(e.amount_sol, 5)}</td>
                    <td className="py-2 pr-3 text-dim whitespace-nowrap">{e.amount_usd != null ? usd(e.amount_usd, 2) : '—'}</td>
                    <td className="py-2 text-dim">
                      {ledgerDetail(e)}
                      {e.tx_signature && <a href={`https://solscan.io/tx/${e.tx_signature}`} target="_blank" rel="noreferrer" className="ml-2 text-green hover:underline inline-flex items-center gap-1">Solscan <ExternalLink className="h-3 w-3" /></a>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-dim">No records yet — the ledger only fills with real, on-chain activity.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-4 text-[10px] text-dim2">
        {t && <a href={t.pump_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">Token on pump.fun <ExternalLink className="h-3 w-3" /></a>}
        {t && <a href={t.solscan_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">Mint on Solscan <ExternalLink className="h-3 w-3" /></a>}
        <span>Nothing here is financial advice. Every buyback row links to its transaction on Solscan.</span>
      </div>
    </div>
  );
}
