import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Settings2, Lock } from 'lucide-react';
import { Panel, Eyebrow, Btn, Field, inputCls, Tag } from '@/components/kit/Primitives';
import { updateFlywheelConfig, errMsg } from '@/lib/api';
import { useRefresh } from '@/hooks/useData';

const FIELDS = [
  ['buyback_pct', 'Buyback share of each purchase (%)', 100, 0.5],
  ['stage_tap_pct', 'Stage tap share of MRR (%)', 100, 0.01],
  ['hashrate_khs', 'Simulated hashrate (kH/s)', 1, 1],
  ['yield_per_khs_hour', 'Yield per kH/s per hour (coins)', 1, 0.0000001],
  ['mined_price_usd', 'Fallback coin price (USD)', 1, 1],
  ['conversion_interval_min', 'Conversion / governor window (min)', 1, 1],
  ['hourly_capacity_sol', 'Governor cap per window (SOL)', 1, 0.01],
  ['min_injection_sol', 'Minimum injection (SOL)', 1, 0.001],
];

export const ConfigPanel = ({ config }) => {
  const refresh = useRefresh();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = {};
    FIELDS.forEach(([k, , scale]) => { next[k] = String(+(config[k] * scale).toFixed(8)); });
    next.mined_symbol = config.mined_symbol;
    setF(next);
  }, [config]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { mined_symbol: f.mined_symbol };
      FIELDS.forEach(([k, , scale]) => { const v = parseFloat(f[k]); if (!Number.isNaN(v)) body[k] = k === 'conversion_interval_min' ? Math.round(v) : v / scale; });
      await updateFlywheelConfig(body);
      refresh();
      toast.success('Flywheel config saved — engine picks it up on the next tick');
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Panel className="p-5" data-testid="config-panel">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Engine config</Eyebrow>
        <Tag tone="amber"><Lock className="h-3 w-3" /> {config.mode}</Tag>
      </div>
      <form onSubmit={save} className="space-y-3">
        <Field label="Mined currency">
          <select value={f.mined_symbol || 'XMR'} onChange={(e) => setF({ ...f, mined_symbol: e.target.value })} className={inputCls} data-testid="config-mined-symbol">
            {['XMR', 'KAS', 'LTC', 'RVN', 'ETC', 'BTC'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        {FIELDS.map(([k, label, , step]) => (
          <Field key={k} label={label}>
            <input type="number" step={step} min={0} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputCls} data-testid={`config-${k}`} />
          </Field>
        ))}
        <Btn type="submit" variant="primary" className="w-full" disabled={busy} data-testid="config-save-btn">{busy ? 'Saving…' : 'Save config'}</Btn>
      </form>
      <p className="text-[9.5px] text-dim2 mt-3 leading-relaxed">Mode is locked to SIMULATED in this build: injections are computed on live curve math and ledgered, never broadcast. Live execution would require a Director-held signer and is intentionally not a toggle.</p>
    </Panel>
  );
};
