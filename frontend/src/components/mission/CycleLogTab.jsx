import React, { useState } from 'react';
import { Panel, Eyebrow } from '@/components/kit/Primitives';
import { SEVERITY_TONE } from '@/lib/constants';
import { dateTime } from '@/lib/format';

const FILTERS = ['all', 'success', 'gate', 'normal'];

export const CycleLogTab = ({ events }) => {
  const [filter, setFilter] = useState('all');
  const [agent, setAgent] = useState('all');
  const agents = ['all', ...Array.from(new Set(events.map((e) => e.agent)))];
  const list = events.filter((e) => (filter === 'all' || e.severity === filter) && (agent === 'all' || e.agent === agent));
  return (
    <Panel className="p-4" data-testid="cycle-log-tab">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Eyebrow>Cycle log · {list.length} events</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} data-testid={`log-filter-${f}`} className={`px-2 py-1 rounded-sm text-[9.5px] uppercase tracking-[1.5px] border ${filter === f ? 'border-purple text-ink bg-purple/15' : 'border-line-subtle text-dim hover:text-ink'}`}>{f}</button>
          ))}
          <select value={agent} onChange={(e) => setAgent(e.target.value)} className="bg-void border border-line-subtle rounded-sm px-2 py-1 text-[9.5px] uppercase tracking-[1px] text-dim" data-testid="log-agent-filter">
            {agents.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1 terminal p-3 rounded-sm border border-line-subtle">
        {list.map((e) => (
          <div key={e.id} className={`border-l-2 pl-3 py-1 text-[11px] leading-relaxed ${SEVERITY_TONE[e.severity] || SEVERITY_TONE.normal}`} data-testid={`event-${e.id}`}>
            <span className="text-dim2">[{dateTime(e.created_at)}]</span> <span className="text-purple">#{e.cycle_n}</span> <span className="font-bold text-ink">{e.agent}</span> <span className="text-dim">›</span> <span className={e.severity === 'normal' ? 'text-ink/80' : ''}>{e.message}</span>
          </div>
        ))}
        {list.length === 0 && <div className="text-dim text-[11px]">No events match this filter.</div>}
      </div>
    </Panel>
  );
};
