import React, { useState } from 'react';
import { toast } from 'sonner';
import { Panel, Tag, Bar, inputCls, Btn } from '@/components/kit/Primitives';
import { useDirectorGuard } from '@/lib/auth';
import { useRefresh } from '@/hooks/useData';
import { updateClient, errMsg } from '@/lib/api';
import { usd, timeAgo } from '@/lib/format';

const STATUS = { QUEUED: 'amber', BUILDING: 'purple', TESTING: 'purple', LIVE: 'green', NEEDS_ATTENTION: 'red' };

const DirectorControls = ({ c }) => {
  const { guard } = useDirectorGuard();
  const refresh = useRefresh();
  const [pct, setPct] = useState(c.build_pct);
  const [status, setStatus] = useState(c.status);
  const [busy, setBusy] = useState(false);
  const save = guard(async () => {
    setBusy(true);
    try { await updateClient(c.id, { build_pct: Number(pct), status }); refresh(); toast.success(`${c.biz} updated`); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  });
  return (
    <div className="flex items-end gap-2 border-t border-line-subtle pt-3" data-testid={`client-controls-${c.id}`}>
      <label className="flex-1 text-[9px] uppercase tracking-[1.5px] text-dim">Build %<input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} className={inputCls + ' mt-1'} data-testid={`client-pct-${c.id}`} /></label>
      <label className="flex-1 text-[9px] uppercase tracking-[1.5px] text-dim">Status<select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls + ' mt-1'} data-testid={`client-status-${c.id}`}>{Object.keys(STATUS).map((s) => <option key={s}>{s}</option>)}</select></label>
      <Btn variant="primary" disabled={busy} onClick={save} data-testid={`client-save-${c.id}`}>Save</Btn>
    </div>
  );
};

export const ClientsTab = ({ clients }) => {
  const { isDirector } = useDirectorGuard();
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="clients-tab">
      {clients.map((c) => (
        <Panel key={c.id} className="p-4 space-y-3 hover:border-purple/50 transition-colors" data-testid={`client-card-${c.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-[13px] font-black">{c.biz}</div>
              <div className="text-[10px] text-dim2">{c.package} · {c.tier} · paid in SOL · {timeAgo(c.created_at)}</div>
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
          {c.scope && <p className="text-[10.5px] text-dim leading-relaxed">{c.scope}</p>}
          <ul className="space-y-1 text-[10.5px] text-dim">
            {(c.deliverables || []).map((d) => <li key={d} className="flex gap-1.5"><span className="text-purple">▸</span>{d}</li>)}
          </ul>
          <div className="text-[10px] text-dim2">Contact: {c.primaryContact}</div>
          {isDirector && <DirectorControls c={c} />}
        </Panel>
      ))}
      {clients.length === 0 && <Panel className="p-6 text-[11px] text-dim md:col-span-2" data-testid="clients-empty">No clients yet. A client record is created the moment a SOL payment is verified on mainnet.</Panel>}
    </div>
  );
};
