import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Settings2, Lock } from 'lucide-react';
import { Panel, Eyebrow, Btn, Field, inputCls, Tag } from '@/components/kit/Primitives';
import { updateFlywheelConfig, errMsg } from '@/lib/api';
import { useRefresh } from '@/hooks/useData';
import { useDirectorGuard } from '@/lib/auth';

const FIELDS = [
  ['buyback_pct', 'Buyback share of each verified SOL payment (%)', 100, 0.5],
  ['window_min', 'Governor window (min)', 1, 1],
  ['hourly_capacity_sol', 'Governor cap per window (SOL)', 1, 0.01],
  ['min_injection_sol', 'Minimum buyback (SOL)', 1, 0.001],
  ['min_wallet_balance_sol', 'Wallet floor kept for fees/rent (SOL)', 1, 0.01],
  ['max_slippage_bps', 'Max slippage (bps)', 1, 10],
];
const INTS = ['window_min', 'max_slippage_bps'];

export const ConfigPanel = ({ config }) => {
  const refresh = useRefresh();
  const { guard, isDirector } = useDirectorGuard();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = {};
    FIELDS.forEach(([k, , scale]) => { next[k] = String(+(config[k] * scale).toFixed(8)); });
    next.signer_wallet = config.signer_wallet || '';
    setF(next);
  }, [config]);

  const save = guard(async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {};
      if (f.signer_wallet && f.signer_wallet.trim().length >= 32) body.signer_wallet = f.signer_wallet.trim();
      FIELDS.forEach(([k, , scale]) => { const v = parseFloat(f[k]); if (!Number.isNaN(v)) body[k] = INTS.includes(k) ? Math.round(v) : v / scale; });
      await updateFlywheelConfig(body);
      refresh();
      toast.success('Engine config saved');
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  });

  return (
    <Panel className="p-5" data-testid="config-panel">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Engine config</Eyebrow>
        <div className="flex gap-1.5">
          {!isDirector && <Tag tone="amber" data-testid="config-locked"><Lock className="h-3 w-3" /> Director only</Tag>}
          <Tag tone="green">LIVE · Director-signed</Tag>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); save(e); }} className="space-y-3">
        {FIELDS.map(([k, label, , step]) => (
          <Field key={k} label={label}>
            <input type="number" step={step} min={0} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputCls} data-testid={`config-${k}`} />
          </Field>
        ))}
        <Field label="Disclosed treasury signer wallet" hint="Shown publicly on the Transparency page. Only this wallet can sign buybacks and transfers.">
          <input value={f.signer_wallet ?? ''} onChange={(e) => setF({ ...f, signer_wallet: e.target.value })} className={inputCls} data-testid="config-signer_wallet" />
        </Field>
        <Btn type="submit" variant="primary" className="w-full" disabled={busy} data-testid="config-save-btn">{busy ? 'Saving…' : isDirector ? 'Save config' : 'Sign in to save config'}</Btn>
      </form>
      <p className="text-[9.5px] text-dim2 mt-3 leading-relaxed">There is no simulation mode. Every governor release becomes a real pump.fun buy that the Director signs in-browser from the disclosed wallet; the backend verifies the SOL and $BASH deltas on-chain before ledgering. No private key ever touches the server.</p>
    </Panel>
  );
};
