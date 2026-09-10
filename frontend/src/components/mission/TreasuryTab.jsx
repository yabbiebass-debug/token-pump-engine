import React, { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';
import { Panel, Eyebrow, Btn, Tag, Field, inputCls, Bar } from '@/components/kit/Primitives';
import { useWallet, useRefresh } from '@/hooks/useData';
import { createWithdrawal, errMsg } from '@/lib/api';
import { SOL_RECIPIENT } from '@/lib/constants';
import { usd, sol, short, dateTime } from '@/lib/format';

const SPLIT = [
  { label: 'Operations', pct: 0.6, tone: 'bg-ink', desc: 'Builder time, hosting, CI, and the Director keeping the lights on.' },
  { label: 'Contributor bounties', pct: 0.2, tone: 'bg-green', desc: 'Paid to outside contributors who land features and fixes on shipped forks.' },
  { label: '$BASH buyback', pct: 0.15, tone: 'bg-purple', desc: 'Converted to SOL on payment and routed into the flywheel reserve.' },
  { label: 'Reserve', pct: 0.05, tone: 'bg-amber', desc: 'Held in the SOL vault for warranty work and upstream security emergencies.' },
];

export const TreasuryTab = ({ payments, withdrawals, vault, fly }) => {
  const refresh = useRefresh();
  const [mode, setMode] = useState('simulated');
  const [amount, setAmount] = useState('');
  const [dest, setDest] = useState(SOL_RECIPIENT);
  const [memo, setMemo] = useState('Director Operational Sweep');
  const [sig, setSig] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: wallet, refetch, isFetching } = useWallet(dest);
  const available = vault?.available_sol ?? 0;
  const solPrice = fly?.derived?.sol_price_usd || 100;
  const buybackPct = fly?.config?.buyback_pct ?? 0.15;
  const split = SPLIT.map((s) => (s.label === '$BASH buyback' ? { ...s, pct: buybackPct } : s.label === 'Operations' ? { ...s, pct: 0.75 - buybackPct } : s));

  const submit = async (e) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return toast.error('Enter an amount');
    if (!confirmed) return toast.error('Director confirmation required');
    setBusy(true);
    try {
      const w = await createWithdrawal({ mode, amount_sol: n, destination_wallet: dest.trim(), memo, signature: sig });
      refresh(); setAmount(''); setSig(''); setConfirmed(false);
      toast.success(`${w.tx_mode === 'onchain' ? 'On-chain attestation verified' : 'Ledger sweep recorded'} · ${sol(w.amount_sol)}`);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="treasury-tab">
      <div className="grid gap-4 md:grid-cols-3">
        <Panel className="p-4"><Eyebrow>SOL deposited (ledger)</Eyebrow><div className="font-display text-[20px] font-black text-green mt-1" data-testid="vault-deposited">{sol(vault?.deposited_sol ?? 0, 2)}</div><div className="text-[10px] text-dim2">{payments.filter((p) => p.method === 'SOLANA').length} on-chain checkouts</div></Panel>
        <Panel className="p-4"><Eyebrow>Withdrawn</Eyebrow><div className="font-display text-[20px] font-black mt-1" data-testid="vault-withdrawn">{sol(vault?.withdrawn_sol ?? 0, 2)}</div><div className="text-[10px] text-dim2">{withdrawals.length} dispatches</div></Panel>
        <Panel className="p-4 border-green/40"><Eyebrow className="text-green">Available</Eyebrow><div className="font-display text-[20px] font-black text-green mt-1" data-testid="vault-available">{sol(available, 2)}</div><div className="text-[10px] text-dim2">≈ {usd(available * solPrice)}</div></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-7 p-5 space-y-4">
          <Eyebrow className="flex items-center justify-between"><span>Vault dispatch</span><Tag tone={mode === 'attest' ? 'green' : 'amber'}>{mode === 'attest' ? 'On-chain attestation' : 'Simulated ledger'}</Tag></Eyebrow>
          <div className="flex gap-2">
            {[['simulated', 'Ledger sweep (simulated)'], ['attest', 'Attest on-chain tx hash']].map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)} data-testid={`withdraw-mode-${m}`} className={`flex-1 border rounded-sm py-2 text-[10px] uppercase tracking-[1.5px] ${mode === m ? 'border-purple bg-purple/15 text-ink' : 'border-line-subtle text-dim hover:text-ink'}`}>{l}</button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={`Amount (SOL) · ≈ ${usd((parseFloat(amount) || 0) * solPrice)}`}>
                <input type="number" step="0.0001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.5" data-testid="withdraw-amount" />
                <div className="flex gap-1 mt-1.5">{[25, 50, 100].map((p) => <button type="button" key={p} onClick={() => setAmount((available * p / 100).toFixed(4))} className="text-[9.5px] px-2 py-0.5 border border-line-subtle rounded text-dim hover:text-ink" data-testid={`withdraw-pct-${p}`}>{p}%</button>)}</div>
              </Field>
              <Field label="Memo"><input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} data-testid="withdraw-memo" /></Field>
            </div>
            <Field label="Destination wallet">
              <div className="flex gap-2">
                <input value={dest} onChange={(e) => setDest(e.target.value)} className={inputCls} data-testid="withdraw-dest" />
                <button type="button" onClick={() => { navigator.clipboard.writeText(dest); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-dim hover:text-ink px-2 border border-line-subtle rounded-sm" data-testid="withdraw-copy-dest">{copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}</button>
              </div>
            </Field>
            {mode === 'attest' && <Field label="Solana tx signature (verified live via RPC)" hint="Paste an 88-char signature that already exists on mainnet. Recorded with slot number."><input value={sig} onChange={(e) => setSig(e.target.value)} className={inputCls} placeholder="4t39fjyTZGij…" data-testid="withdraw-signature" /></Field>}
            <label className="flex items-center gap-2 text-[11px] text-dim cursor-pointer"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="withdraw-confirm-checkbox" /> I am the Director and authorise this dispatch.</label>
            <Btn type="submit" variant="green" disabled={busy || !confirmed} data-testid="withdraw-submit">{busy ? 'Dispatching…' : mode === 'attest' ? 'Verify & record' : 'Execute ledger sweep'}</Btn>
          </form>
        </Panel>

        <Panel className="lg:col-span-5 p-5 space-y-3" data-testid="live-wallet-panel">
          <Eyebrow className="flex items-center justify-between">
            <span>Live on-chain · {short(dest)}</span>
            <button onClick={() => refetch()} className="text-dim hover:text-green" data-testid="wallet-refresh-btn"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /></button>
          </Eyebrow>
          {wallet ? (
            <>
              <div className="font-display text-[20px] font-black text-green" data-testid="wallet-balance">{sol(wallet.balance_sol, 6)}</div>
              <div className="text-[10px] text-dim2">Slot {wallet.slot.toLocaleString()} · mainnet-beta · {usd(wallet.balance_sol * solPrice, 2)}</div>
              <div className="space-y-1.5 pt-1">
                {wallet.signatures.map((s) => (
                  <a key={s.signature} href={`https://solscan.io/tx/${s.signature}`} target="_blank" rel="noreferrer" className="flex items-center justify-between text-[10px] border border-line-subtle rounded-sm px-2 py-1.5 hover:border-green/50 group">
                    <span className="text-ink group-hover:text-green">{short(s.signature, 10, 8)}</span>
                    <span className="text-dim2 flex items-center gap-1">{s.err ? <span className="text-red">failed</span> : s.confirmation_status} <ExternalLink className="h-3 w-3" /></span>
                  </a>
                ))}
              </div>
              <a href={wallet.solscan_url} target="_blank" rel="noreferrer" className="text-[10px] text-purple hover:underline flex items-center gap-1">Open on Solscan <ExternalLink className="h-3 w-3" /></a>
            </>
          ) : <div className="text-[11px] text-dim">Querying Solana RPC…</div>}
        </Panel>
      </div>

      <Panel className="p-5">
        <Eyebrow className="mb-3">Revenue split model</Eyebrow>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full mb-4">{split.map((s) => <div key={s.label} className={s.tone} style={{ width: `${s.pct * 100}%` }} />)}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {split.map((s) => (
            <div key={s.label} className="text-[11px]"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${s.tone}`} /><span className="font-bold">{s.label}</span><span className="text-dim ml-auto">{Math.round(s.pct * 100)}%</span></div><p className="text-[10px] text-dim2 mt-1">{s.desc}</p></div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <Eyebrow className="mb-3">Dispatch history</Eyebrow>
        <div className="space-y-1.5">
          {withdrawals.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px]" data-testid={`withdrawal-${w.id}`}>
              <div className="flex items-center gap-2"><Tag tone={w.tx_mode === 'onchain' ? 'green' : 'amber'}>{w.tx_mode}</Tag><span className="font-bold">{sol(w.amount_sol)}</span><span className="text-dim2">≈ {usd(w.amount_usd_est)}</span></div>
              <div className="text-dim">{w.memo}</div>
              <div className="flex items-center gap-2 text-dim2">
                {w.tx_mode === 'onchain' ? <a href={`https://solscan.io/tx/${w.tx_signature}`} target="_blank" rel="noreferrer" className="text-green hover:underline flex items-center gap-1">{short(w.tx_signature, 8, 6)} <ExternalLink className="h-3 w-3" /></a> : <span>{w.tx_signature}</span>}
                <span>{dateTime(w.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <Eyebrow className="mb-3">Payment ledger</Eyebrow>
        <div className="space-y-1.5">
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-line-subtle rounded-sm px-3 py-2 text-[10.5px]" data-testid={`payment-${p.id}`}>
              <div className="flex items-center gap-2"><Tag tone={p.method === 'SOLANA' ? 'green' : p.method === 'PAYPAL' ? 'purple' : 'dim'}>{p.method}</Tag><span className="font-bold">{p.biz}</span><span className="text-dim">{p.package} · {p.tier}</span></div>
              <div className="flex items-center gap-3"><span className="text-green font-bold">{usd(p.amount_usd)}</span>{p.sol_amount && <span className="text-dim2">{sol(p.sol_amount, 2)}</span>}<span className="text-purple">→ {usd(p.amount_usd * buybackPct)} buyback</span><span className="text-dim2">{p.reference}</span></div>
            </div>
          ))}
        </div>
        <Bar value={100} tone="bg-purple/40" className="mt-4 opacity-40" />
      </Panel>
    </div>
  );
};
