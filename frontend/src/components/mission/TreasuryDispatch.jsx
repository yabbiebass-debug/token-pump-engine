import React, { useState } from 'react';
import { toast } from 'sonner';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Send, ShieldCheck, ShieldAlert, FileSignature } from 'lucide-react';
import { Panel, Eyebrow, Btn, Tag, Field, inputCls } from '@/components/kit/Primitives';
import { useRefresh } from '@/hooks/useData';
import { useDirectorGuard } from '@/lib/auth';
import { useSolTransfer } from '@/lib/solana';
import { createWithdrawal, errMsg } from '@/lib/api';
import { sol, usd, short } from '@/lib/format';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const TreasuryDispatch = ({ vault }) => {
  const refresh = useRefresh();
  const { guard, isDirector } = useDirectorGuard();
  const { transfer, connected, address } = useSolTransfer();
  const [tab, setTab] = useState('wallet');
  const [amount, setAmount] = useState('');
  const [dest, setDest] = useState('');
  const [memo, setMemo] = useState('Director treasury transfer');
  const [sig, setSig] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState('');
  const treasury = vault?.address;
  const signerOk = connected && address === treasury;
  const balance = vault?.balance_sol ?? 0;
  const solPrice = vault?.sol_price_usd || 100;

  const record = async (signature) => {
    for (let i = 0; i < 8; i += 1) {
      try { return await createWithdrawal({ signature, memo }); } catch (e) {
        if (e.response?.status === 409 && /not confirmed/i.test(errMsg(e)) && i < 7) { await sleep(4000); continue; }
        throw e;
      }
    }
    return null;
  };

  const send = guard(async () => {
    const n = parseFloat(amount);
    if (!signerOk) return toast.error('Connect the treasury wallet to send from it');
    if (!n || n <= 0) return toast.error('Enter an amount');
    if (dest.trim().length < 32) return toast.error('Enter a destination wallet');
    if (!confirmed) return toast.error('Director confirmation required');
    try {
      setStep('Approve the transfer in your wallet…');
      const signature = await transfer(dest.trim(), n);
      setStep('Confirmed on-chain · recording…');
      const w = await record(signature);
      refresh(); setAmount(''); setConfirmed(false);
      toast.success(`Sent ${sol(w.amount_sol)} → ${short(w.destination_wallet)} · verified on-chain`);
    } catch (e) { toast.error(errMsg(e) || e.message); } finally { setStep(''); }
  });

  const attest = guard(async () => {
    if (sig.trim().length < 64) return toast.error('Paste the full transaction signature');
    if (!confirmed) return toast.error('Director confirmation required');
    try {
      setStep('Reading transaction from mainnet…');
      const w = await record(sig.trim());
      refresh(); setSig(''); setConfirmed(false);
      toast.success(`Recorded ${sol(w.amount_sol)} → ${short(w.destination_wallet)} from on-chain data`);
    } catch (e) { toast.error(errMsg(e)); } finally { setStep(''); }
  });

  return (
    <Panel className="p-5 space-y-4" data-testid="treasury-dispatch">
      <Eyebrow className="flex items-center justify-between"><span>Treasury transfer · real SOL</span><Tag tone="green">On-chain only</Tag></Eyebrow>
      <div className="flex gap-2">
        {[['wallet', 'Sign with treasury wallet'], ['attest', 'Record an existing tx']].map(([m, l]) => (
          <button key={m} onClick={() => setTab(m)} data-testid={`withdraw-mode-${m}`} className={`flex-1 border rounded-sm py-2 text-[10px] uppercase tracking-[1.5px] ${tab === m ? 'border-purple bg-purple/15 text-ink' : 'border-line-subtle text-dim hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {!isDirector && <div className="text-[10.5px] text-amber border border-amber/30 bg-amber/5 rounded-sm px-3 py-2" data-testid="withdraw-locked-notice">Director login required to move treasury funds.</div>}

      {tab === 'wallet' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="wallet-btn" data-testid="withdraw-wallet-connect"><WalletMultiButton /></div>
            {connected && (
              <span className={`flex items-center gap-1.5 text-[10.5px] ${signerOk ? 'text-green' : 'text-red'}`} data-testid="withdraw-signer-check">
                {signerOk ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {signerOk ? `Treasury wallet connected · ${short(address)}` : `${short(address)} is not the treasury ${short(treasury || '')}`}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={`Amount (SOL) · ≈ ${usd((parseFloat(amount) || 0) * solPrice, 2)} · on-chain ${sol(balance, 4)}`}>
              <input type="number" step="0.0001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.05" data-testid="withdraw-amount" />
              <div className="flex gap-1 mt-1.5">{[25, 50, 90].map((p) => <button type="button" key={p} onClick={() => setAmount(Math.max(0, (balance - 0.001) * p / 100).toFixed(4))} className="text-[9.5px] px-2 py-0.5 border border-line-subtle rounded text-dim hover:text-ink" data-testid={`withdraw-pct-${p}`}>{p}%</button>)}</div>
            </Field>
            <Field label="Memo (ledger only)"><input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} data-testid="withdraw-memo" /></Field>
          </div>
          <Field label="Destination wallet"><input value={dest} onChange={(e) => setDest(e.target.value)} className={inputCls} placeholder="Recipient Solana address" data-testid="withdraw-dest" /></Field>
        </div>
      )}

      {tab === 'attest' && (
        <Field label="Solana tx signature of a transfer out of the treasury" hint="Amount and destination are read from the transaction itself — nothing is typed in.">
          <input value={sig} onChange={(e) => setSig(e.target.value)} className={inputCls} placeholder="87–88 character signature" data-testid="withdraw-signature" />
        </Field>
      )}

      <label className="flex items-center gap-2 text-[11px] text-dim cursor-pointer"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} data-testid="withdraw-confirm-checkbox" /> I am the Director and authorise this transfer.</label>
      {step && <div className="text-[10.5px] text-green" data-testid="withdraw-step">{step}</div>}
      {tab === 'wallet'
        ? <Btn variant="green" disabled={!!step || !confirmed || !signerOk} onClick={send} data-testid="withdraw-submit"><Send className="h-3.5 w-3.5" /> Sign &amp; send</Btn>
        : <Btn variant="green" disabled={!!step || !confirmed} onClick={attest} data-testid="withdraw-attest-submit"><FileSignature className="h-3.5 w-3.5" /> Verify &amp; record</Btn>}
      <p className="text-[9.5px] text-dim2 leading-relaxed">The server never holds a key. A transfer is built in your browser, signed by the treasury wallet, confirmed on mainnet, then read back and ledgered with its Solscan link.</p>
    </Panel>
  );
};
