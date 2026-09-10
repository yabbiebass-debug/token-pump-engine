import React, { useState } from 'react';
import { toast } from 'sonner';
import { X, ShieldAlert, Check, Ban, ShieldCheck } from 'lucide-react';
import { Btn } from '@/components/kit/Primitives';
import { approveGate, rejectGate, errMsg } from '@/lib/api';
import { useRefresh } from '@/hooks/useData';

export const DirectorGateModal = ({ approval, onClose }) => {
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  if (!approval) return null;

  const decide = async (fn, label) => {
    setBusy(true);
    try { await fn(approval.id); refresh(); toast.success(`Gate ${label}: ${approval.title}`); onClose(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm p-4" data-testid="director-gate-modal" onClick={onClose}>
      <div className="w-full max-w-xl border border-amber/50 bg-panel p-6 rounded-sm shadow-2xl space-y-5 animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-amber/15 border border-amber text-amber"><ShieldAlert className="h-4 w-4" /></div>
            <div>
              <div className="text-[9px] uppercase tracking-[2px] font-bold text-amber">Director gate · human sign-off required</div>
              <h3 className="font-display text-[15px] font-black">{approval.title}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-dim hover:text-ink p-1" data-testid="gate-close-btn"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-[12px] text-dim leading-relaxed">{approval.detail}</p>
        <div className="border border-line bg-panel2 p-4 rounded-sm text-[11.5px] space-y-2">
          <div className="text-[10px] uppercase tracking-[1.5px] text-purple font-bold">Synthesized agent payload ({approval.agent})</div>
          <pre className="overflow-x-auto whitespace-pre-wrap bg-void/50 p-2.5 rounded-sm border border-line-subtle text-[10.5px]">{JSON.stringify(approval.payload, null, 2)}</pre>
        </div>
        {approval.license && (
          <div className="flex items-center gap-2 text-[11px] text-green bg-green/10 border border-green/30 p-2.5 rounded-sm"><ShieldCheck className="h-4 w-4" /> Commercial compliance verified: {approval.license} ({approval.license_class})</div>
        )}
        <div className="flex items-center justify-between border-t border-line pt-4">
          <Btn variant="danger" disabled={busy} onClick={() => decide(rejectGate, 'rejected')} data-testid="gate-reject-btn"><Ban className="h-3.5 w-3.5" /> Reject & recalibrate</Btn>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={onClose} data-testid="gate-cancel-btn">Cancel</Btn>
            <Btn variant="amber" disabled={busy} onClick={() => decide(approveGate, 'approved')} data-testid="gate-approve-btn"><Check className="h-3.5 w-3.5" /> Approve & dispatch</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};
