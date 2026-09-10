import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, ShieldAlert, ExternalLink } from 'lucide-react';
import { Panel, Eyebrow, Btn, Tag, inputCls } from '@/components/kit/Primitives';
import { LEAD_STAGES, GATED } from '@/lib/constants';
import { moveLead, errMsg } from '@/lib/api';
import { useRefresh } from '@/hooks/useData';
import { timeAgo, usd } from '@/lib/format';
import { DirectorGateModal } from '@/components/mission/DirectorGateModal';
import { AddLeadModal } from '@/components/mission/AddLeadModal';

export const PipelineTab = ({ leads, approvals }) => {
  const refresh = useRefresh();
  const [gate, setGate] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const pending = approvals.filter((a) => a.status === 'pending');

  const onMove = async (id, stage) => {
    try { await moveLead(id, stage); refresh(); toast(`Lead moved to ${stage}`); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-4" data-testid="pipeline-tab">
      <Panel className="p-4 border-amber/40">
        <Eyebrow className="text-amber flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Director gates · {pending.length} awaiting sign-off</span>
        </Eyebrow>
        {pending.length === 0 ? (
          <div className="text-[11px] text-dim">No pending approvals. Run a cycle to generate the next roadmap gate.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {pending.slice(0, 6).map((a) => (
              <button key={a.id} onClick={() => setGate(a)} data-testid={`gate-${a.id}`}
                className="text-left border border-amber/30 bg-amber/5 hover:bg-amber/10 p-3 rounded-sm transition-colors">
                <div className="flex items-center justify-between gap-2"><span className="text-[9px] uppercase tracking-[1.5px] text-amber font-bold">{a.type.replace('_', ' ')} · {a.agent}</span><span className="text-[9px] text-dim2">{timeAgo(a.created_at)}</span></div>
                <div className="text-[12px] font-bold mt-1">{a.title}</div>
                <div className="text-[10.5px] text-dim mt-0.5 line-clamp-2">{a.detail}</div>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>Opportunity pipeline · {leads.length} leads</Eyebrow>
          <Btn variant="primary" onClick={() => setAddOpen(true)} data-testid="add-lead-btn"><Plus className="h-3.5 w-3.5" /> Inject request</Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-[1.5px] text-dim border-b border-line-subtle">
                <th className="py-2 pr-3">Business</th><th className="py-2 pr-3">Niche · region</th><th className="py-2 pr-3">Fit</th><th className="py-2 pr-3">Value</th><th className="py-2 pr-3">Stage</th><th className="py-2">Age</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-line-subtle/60 hover:bg-panel2/60 transition-colors" data-testid={`lead-row-${l.id}`}>
                  <td className="py-2.5 pr-3">
                    <div className="font-bold">{l.biz}</div>
                    <div className="text-[10px] text-dim2 max-w-[260px] truncate" title={l.pain}>{l.pain}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-dim">{l.niche}<div className="text-[10px] text-dim2">{l.region}</div></td>
                  <td className="py-2.5 pr-3"><span className={`font-display font-black ${l.score >= 90 ? 'text-green' : l.score >= 80 ? 'text-ink' : 'text-amber'}`}>{l.score}</span><span className="text-dim2">/100</span></td>
                  <td className="py-2.5 pr-3 text-dim">{usd(l.estimatedValue)}</td>
                  <td className="py-2.5 pr-3">
                    <select value={l.stage} onChange={(e) => onMove(l.id, e.target.value)} data-testid={`lead-stage-${l.id}`}
                      className={`${inputCls} !w-auto !py-1 !px-2 text-[10px] ${GATED.has(l.stage) ? '!border-amber/50 text-amber' : ''}`}>
                      {LEAD_STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 text-dim2">{timeAgo(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2 text-[10px] text-dim2">
        <Tag tone="dim">Source of truth: MongoDB</Tag>
        <Tag tone="amber">Gated stages: PITCH · CLOSE · SHIP</Tag>
        <a href="https://github.com/bashammm/YABBAI---BASHAM-AUTO" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">upstream repo <ExternalLink className="h-3 w-3" /></a>
      </div>

      <DirectorGateModal approval={gate} onClose={() => setGate(null)} />
      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
};
