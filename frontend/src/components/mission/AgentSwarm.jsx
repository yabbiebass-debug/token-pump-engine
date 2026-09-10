import React from 'react';
import { Panel, Eyebrow } from '@/components/kit/Primitives';
import { useMeta } from '@/hooks/useData';

export const AgentSwarm = () => {
  const { data } = useMeta();
  const agents = data?.agents || [];
  return (
    <Panel className="p-4 space-y-3" data-testid="agent-swarm">
      <Eyebrow className="flex items-center justify-between"><span>Agent swarm ({agents.length})</span><span className="text-green text-[9px]">All active</span></Eyebrow>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {agents.map((a) => (
          <div key={a.name} className="border border-line bg-panel2 p-2.5 rounded-sm text-[11px] hover:border-purple/50 transition-colors" data-testid={`agent-${a.name.toLowerCase()}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5"><span className={`inline-block h-1.5 w-1.5 rounded-full ${a.name === 'INJECTOR' ? 'bg-green animate-pulse' : 'bg-green'}`} />{a.name}</span>
              <span className={`text-[9px] px-1.5 rounded border ${a.status === 'GATED' ? 'bg-amber/15 text-amber border-amber/30' : 'bg-green/10 text-green border-green/30'}`}>{a.status}</span>
            </div>
            <div className="text-[9px] text-dim2 mt-0.5">{a.code} · {a.activeCount} tasks</div>
            <p className="text-[10px] text-dim leading-relaxed mt-1">{a.role}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
};
