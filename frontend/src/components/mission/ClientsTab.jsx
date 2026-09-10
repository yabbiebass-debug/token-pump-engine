import React from 'react';
import { Panel, Tag, Bar } from '@/components/kit/Primitives';
import { usd, timeAgo } from '@/lib/format';

const STATUS = { QUEUED: 'amber', BUILDING: 'purple', TESTING: 'purple', LIVE: 'green', NEEDS_ATTENTION: 'red' };

export const ClientsTab = ({ clients }) => (
  <div className="grid gap-3 md:grid-cols-2" data-testid="clients-tab">
    {clients.map((c) => (
      <Panel key={c.id} className="p-4 space-y-3 hover:border-purple/50 transition-colors" data-testid={`client-card-${c.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-display text-[13px] font-black">{c.biz}</div>
            <div className="text-[10px] text-dim2">{c.package} · {c.tier} · via {c.created_via} · {timeAgo(c.created_at)}</div>
          </div>
          <Tag tone={STATUS[c.status] || 'dim'}>{c.status}</Tag>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-dim mb-1"><span>Build progress</span><span className="text-ink">{c.build_pct}%</span></div>
          <Bar value={c.build_pct} tone={c.build_pct >= 100 ? 'bg-green' : 'bg-purple'} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div><div className="text-[9px] uppercase tracking-[1.5px] text-dim">Setup</div><div className="font-bold">{usd(c.setup_fee)}</div></div>
          <div><div className="text-[9px] uppercase tracking-[1.5px] text-dim">MRR</div><div className="font-bold text-green">{usd(c.mrr)}</div></div>
          <div><div className="text-[9px] uppercase tracking-[1.5px] text-dim">Health</div><div className={`font-bold ${c.health === 'GREEN' ? 'text-green' : c.health === 'AMBER' ? 'text-amber' : 'text-red'}`}>{c.health}</div></div>
        </div>
        <ul className="space-y-1 text-[10.5px] text-dim">
          {(c.deliverables || []).map((d) => <li key={d} className="flex gap-1.5"><span className="text-purple">▸</span>{d}</li>)}
        </ul>
        {(c.techStack || []).length > 0 && <div className="flex flex-wrap gap-1">{c.techStack.map((t) => <Tag key={t} tone="dim">{t}</Tag>)}</div>}
        <div className="text-[10px] text-dim2">Contact: {c.primaryContact}</div>
      </Panel>
    ))}
  </div>
);
