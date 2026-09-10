import React from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Panel, Eyebrow, Tag } from '@/components/kit/Primitives';
import { useTreasuryActivity } from '@/hooks/useData';
import { sol, short, dateTime, compact } from '@/lib/format';

const KIND = {
  deposit: { label: 'SOL IN', tone: 'green' },
  transfer_out: { label: 'SOL OUT', tone: 'amber' },
  buyback: { label: '$BASH BUY', tone: 'purple' },
  token_out: { label: '$BASH OUT', tone: 'red' },
  failed: { label: 'FAILED', tone: 'red' },
  other: { label: 'OTHER', tone: 'dim' },
};

const describe = (a) => {
  if (a.kind === 'buyback') return `${compact(a.token_delta)} $BASH bought for ${Math.abs(a.sol_delta).toFixed(4)} SOL`;
  if (a.kind === 'deposit') return `from ${short(a.counterparty || '')}${a.payment_biz ? ` · payment by ${a.payment_biz}` : ''}`;
  if (a.kind === 'transfer_out') return `to ${short(a.counterparty || '')}${a.withdrawal_id ? ' · recorded transfer' : ''}`;
  if (a.kind === 'failed') return `failed tx · fee ${a.fee_sol.toFixed(6)} SOL`;
  return '';
};

export const TreasuryActivity = () => {
  const { data, refetch, isFetching } = useTreasuryActivity();
  const items = data?.items || [];
  return (
    <Panel className="p-5" data-testid="treasury-activity">
      <Eyebrow className="flex items-center justify-between mb-3">
        <span>On-chain activity · {items.length} tx</span>
        <button onClick={() => refetch()} className="text-dim hover:text-green" data-testid="treasury-activity-refresh"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /></button>
      </Eyebrow>
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {items.map((a) => {
          const k = KIND[a.kind] || KIND.other;
          return (
            <a key={a.signature} href={`https://solscan.io/tx/${a.signature}`} target="_blank" rel="noreferrer" className="flex flex-wrap items-center justify-between gap-2 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px] hover:border-green/40" data-testid={`treasury-tx-${a.id}`}>
              <div className="flex items-center gap-2"><Tag tone={k.tone}>{k.label}</Tag><span className={`font-display font-black ${a.sol_delta >= 0 ? 'text-green' : 'text-ink'}`}>{a.sol_delta >= 0 ? '+' : ''}{sol(a.sol_delta, 4)}</span></div>
              <div className="text-dim">{describe(a)}</div>
              <div className="flex items-center gap-2 text-dim2">{short(a.signature, 8, 6)} <ExternalLink className="h-3 w-3" /><span>{dateTime(a.created_at)}</span></div>
            </a>
          );
        })}
        {items.length === 0 && <div className="text-[11px] text-dim py-4 text-center">Indexing the treasury wallet from Solana mainnet…</div>}
      </div>
    </Panel>
  );
};
