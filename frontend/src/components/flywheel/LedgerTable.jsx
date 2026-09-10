import React, { useState } from 'react';
import { Panel, Eyebrow } from '@/components/kit/Primitives';
import { LEDGER_TONE } from '@/lib/constants';
import { sol, usd, compact, dateTime, hhmm } from '@/lib/format';

const TYPES = ['all', 'injection', 'delayed', 'allocation'];

export const ledgerDetail = (e) => {
  switch (e.type) {
    case 'allocation': return `${Math.round(e.pct * 100)}% of verified payment · ${e.biz} (${e.package})`;
    case 'injection': return `${compact(e.tokens_acquired)} $BASH · impact ${Number(e.impact_pct).toFixed(2)}% · curve ${Number(e.curve_progress_after_pct).toFixed(3)}% · ${e.trigger}`;
    case 'delayed': return `Cap ${e.cap_sol} SOL reached (${e.trigger}) · resumes ${hhmm(e.resumes_at)}`;
    default: return '';
  }
};

export const LedgerTable = ({ ledger }) => {
  const [type, setType] = useState('all');
  const rows = ledger.filter((e) => type === 'all' || e.type === type);
  return (
    <Panel className="p-4" data-testid="ledger-table">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Eyebrow>Flywheel ledger · {rows.length} entries</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => <button key={t} onClick={() => setType(t)} data-testid={`ledger-filter-${t}`} className={`px-2 py-1 rounded-sm text-[9px] uppercase tracking-[1.5px] border ${type === t ? 'border-purple text-ink bg-purple/15' : 'border-line-subtle text-dim hover:text-ink'}`}>{t === 'injection' ? 'buyback' : t}</button>)}
        </div>
      </div>
      <div className="max-h-[520px] overflow-y-auto pr-1 space-y-1">
        {rows.map((e) => {
          const tone = LEDGER_TONE[e.type] || LEDGER_TONE.other;
          return (
            <div key={e.id} className="grid grid-cols-[92px_1fr_auto] sm:grid-cols-[100px_110px_1fr_auto] items-center gap-3 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px] hover:bg-panel2/60" data-testid={`ledger-${e.id}`}>
              <span className={`text-[8.5px] uppercase tracking-[1.5px] px-1.5 py-0.5 rounded border font-bold text-center ${tone.cls}`}>{tone.label}</span>
              <span className={`font-display font-black text-[12px] hidden sm:block ${e.type === 'delayed' ? 'text-red' : e.type === 'injection' ? 'text-green' : 'text-ink'}`}>{e.type === 'delayed' ? '⏸ ' : e.type === 'injection' ? '− ' : '+ '}{sol(e.amount_sol, 5)}</span>
              <span className="text-dim truncate" title={ledgerDetail(e)}>
                {ledgerDetail(e)}{e.amount_usd != null ? ` · ${usd(e.amount_usd, 2)}` : ''}
                {e.tx_signature && <a href={`https://solscan.io/tx/${e.tx_signature}`} target="_blank" rel="noreferrer" className="ml-2 text-green hover:underline" data-testid={`ledger-tx-${e.id}`}>tx ↗</a>}
              </span>
              <span className="text-dim2 whitespace-nowrap">{dateTime(e.created_at)}</span>
            </div>
          );
        })}
        {rows.length === 0 && <div className="text-[11px] text-dim py-6 text-center">No entries yet. The ledger fills only with verified SOL payments, governor decisions, and on-chain buybacks.</div>}
      </div>
    </Panel>
  );
};
