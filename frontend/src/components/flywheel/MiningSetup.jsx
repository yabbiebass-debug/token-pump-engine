import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Terminal, Copy, Check, Trophy, Save } from 'lucide-react';
import { Panel, Eyebrow, Tag, Btn, Field, inputCls } from '@/components/kit/Primitives';
import { useMining, useRefresh } from '@/hooks/useData';
import { useDirectorGuard } from '@/lib/auth';
import { estimateMining, updateFlywheelConfig, errMsg } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { sol, usd } from '@/lib/format';

export const MiningSetup = () => {
  const { data: m } = useMining();
  const refresh = useRefresh();
  const { guard, isDirector } = useDirectorGuard();
  const [rates, setRates] = useState({});
  const [share, setShare] = useState('100');
  const [worker, setWorker] = useState('rig1');
  const [algo, setAlgo] = useState('randomx');
  const [est, setEst] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!m) return;
    setRates((r) => (Object.keys(r).length ? r : Object.fromEntries(Object.entries(m.hashrates || {}).map(([k, v]) => [k, String(v)]))));
    setShare(String(Math.round((m.share_pct ?? 1) * 100)));
  }, [m]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try { setEst(await estimateMining(Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, parseFloat(v) || 0])))); } catch (_) { /* keep last */ }
    }, 350);
    return () => clearTimeout(t);
  }, [rates]);

  const save = guard(async () => {
    setBusy(true);
    try {
      await updateFlywheelConfig({ mining_share_pct: Math.min(1, Math.max(0, (parseFloat(share) || 0) / 100)), mining_hashrates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, parseFloat(v) || 0])) });
      refresh();
      toast.success('Mining config saved');
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  });

  if (!m) return null;
  const a = m.algos[algo];
  const cmd = a.cmd.replace('{addr}', m.address).replace('{worker}', worker.replace(/[^A-Za-z0-9_-]/g, '') || 'rig1');
  const rows = est?.rows || [];
  const best = rows.find((r) => r.usd_day > 0) || rows[0];
  const copy = async () => { if (await copyText(cmd)) { setCopied(true); toast('Command copied'); setTimeout(() => setCopied(false), 1500); } };

  return (
    <Panel className="p-5 space-y-5" data-testid="mining-setup">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow className="flex items-center gap-1.5 text-amber"><Trophy className="h-3.5 w-3.5" /> Best coin for your hashrate · live</Eyebrow>
        {est && <span className="text-[9.5px] text-dim2">BTC {usd(est.btc_usd)} · SOL {usd(est.sol_usd, 2)} · pool fee {est.pool_fee_pct}% · WhatToMine</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[10.5px]" data-testid="mining-profit-table">
          <thead><tr className="text-left text-[9px] uppercase tracking-[1.5px] text-dim border-b border-line-subtle"><th className="py-2 pr-2">Algorithm</th><th className="py-2 pr-2">Your hashrate</th><th className="py-2 pr-2">SOL / day</th><th className="py-2 pr-2">USD / day</th><th className="py-2">Per unit</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.algo} className={`border-b border-line-subtle/60 ${best?.algo === r.algo && r.usd_day > 0 ? 'bg-amber/5' : ''}`} data-testid={`mining-row-${r.algo}`}>
                <td className="py-1.5 pr-2"><div className="font-bold">{r.label} <span className="text-dim2 font-normal">· {r.coin} · {r.hw}</span></div></td>
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} step="any" value={rates[r.algo] ?? ''} placeholder="0" onChange={(e) => setRates({ ...rates, [r.algo]: e.target.value })} className={inputCls + ' !w-24 !py-1'} data-testid={`mining-hashrate-${r.algo}`} />
                    <span className="text-dim2">{r.unit}</span>
                  </div>
                </td>
                <td className="py-1.5 pr-2 font-display font-black text-green">{r.sol_day ? sol(r.sol_day, 5) : '—'}</td>
                <td className="py-1.5 pr-2 text-ink">{r.usd_day ? usd(r.usd_day, 3) : '—'}</td>
                <td className="py-1.5 text-dim2">{usd(r.per_unit_usd_day, 4)} / {r.unit} / day</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {best && best.usd_day > 0 && <div className="text-[10.5px] text-amber" data-testid="mining-best">Best for your rig: <b>{best.label}</b> ≈ {sol(best.sol_day, 5)} / day ≈ {sol(best.sol_month, 4)} / month → {Math.round((parseFloat(share) || 0))}% of every payout goes to $BASH buybacks.</div>}

      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Algorithm for the command">
          <select value={algo} onChange={(e) => setAlgo(e.target.value)} className={inputCls} data-testid="mining-algo-select">{Object.entries(m.algos).map(([k, v]) => <option key={k} value={k}>{v.label} · {v.hw}</option>)}</select>
        </Field>
        <Field label="Worker name"><input value={worker} onChange={(e) => setWorker(e.target.value)} className={inputCls} data-testid="mining-worker-input" /></Field>
        <Field label="Share of payouts → buybacks (%)"><input type="number" min={0} max={100} value={share} onChange={(e) => setShare(e.target.value)} className={inputCls} data-testid="mining-share-input" /></Field>
      </div>

      <div className="space-y-2" data-testid="mining-command-block">
        <Eyebrow className="flex items-center gap-1.5"><Terminal className="h-3 w-3" /> Run this on your rig ({a.miner}) · pool {a.pool}</Eyebrow>
        <div className="flex items-start gap-2 terminal border border-line-subtle rounded-sm p-3">
          <code className="text-[10.5px] text-green break-all flex-1" data-testid="mining-command">{cmd}</code>
          <button onClick={copy} className="text-dim hover:text-green shrink-0" data-testid="mining-copy-cmd">{copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}</button>
        </div>
        <div className="text-[9.5px] text-dim2 leading-relaxed">Payout coin is fixed to <b>SOL</b> and the address is the treasury wallet, so the pool does the “mine X → convert to SOL” step for you. Runs on your own hardware or any rented rig (NiceHash, Vast.io, etc.) — the app server is not a miner and never will be.</div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {!isDirector && <Tag tone="amber">Director login to save</Tag>}
        <Btn variant="primary" className="ml-auto" disabled={busy} onClick={save} data-testid="mining-save-btn"><Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : 'Save hashrates & share'}</Btn>
      </div>
    </Panel>
  );
};
