import React, { useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Btn, Field, inputCls } from '@/components/kit/Primitives';
import { createLead, errMsg } from '@/lib/api';
import { useRefresh } from '@/hooks/useData';
import { NICHES } from '@/lib/constants';

export const AddLeadModal = ({ open, onClose }) => {
  const refresh = useRefresh();
  const [f, setF] = useState({ biz: '', email: '', niche: NICHES[0], region: 'Worldwide', pain: '' });
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.biz.trim()) return;
    setBusy(true);
    try { const l = await createLead(f); refresh(); toast.success(`"${l.biz}" queued into Mission Control (fit ${l.score}/100)`); setF({ biz: '', email: '', niche: NICHES[0], region: 'Worldwide', pain: '' }); onClose(); }
    catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/85 backdrop-blur-sm p-4" data-testid="add-lead-modal" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg border border-purple/50 bg-panel p-6 rounded-sm space-y-4 animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="font-display text-[14px] font-black">Inject product request</h3>
          <button type="button" onClick={onClose} className="text-dim hover:text-ink" data-testid="add-lead-close"><X className="h-4 w-4" /></button>
        </div>
        <Field label="Business / community *"><input value={f.biz} onChange={set('biz')} className={inputCls} data-testid="add-lead-biz" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input value={f.email} onChange={set('email')} className={inputCls} data-testid="add-lead-email" /></Field>
          <Field label="Region"><input value={f.region} onChange={set('region')} className={inputCls} data-testid="add-lead-region" /></Field>
        </div>
        <Field label="Niche"><select value={f.niche} onChange={set('niche')} className={inputCls} data-testid="add-lead-niche">{NICHES.map((n) => <option key={n}>{n}</option>)}</select></Field>
        <Field label="Pain / what's missing"><textarea rows={3} value={f.pain} onChange={set('pain')} className={inputCls + ' resize-none'} data-testid="add-lead-pain" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={busy || !f.biz.trim()} data-testid="add-lead-submit">Queue for SCOUT</Btn>
        </div>
      </form>
    </div>
  );
};
