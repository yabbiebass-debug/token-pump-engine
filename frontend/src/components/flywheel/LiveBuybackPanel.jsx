import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Buffer } from 'buffer';
import { VersionedTransaction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Radio, ShieldCheck, ShieldAlert, ExternalLink, Zap, XCircle, RefreshCw } from 'lucide-react';
import { Panel, Eyebrow, Tag, Btn, Field, inputCls } from '@/components/kit/Primitives';
import { useLiveStatus, useRefresh } from '@/hooks/useData';
import { useDirectorGuard } from '@/lib/auth';
import { liveBuild, liveConfirm, liveDismiss, injectNow, errMsg } from '@/lib/api';
import { sol, usd, compact, short, timeAgo, hhmm, pct } from '@/lib/format';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEPS = { building: 'Quoting route on Jupiter…', signing: 'Approve the buy in your wallet…', ledgering: 'Waiting for confirmation & ledgering…' };

const Balances = ({ live }) => {
  const w = live?.wallet;
  return (
    <div className="grid grid-cols-2 gap-3 border border-line-subtle bg-void/60 rounded-sm p-3" data-testid="live-treasury-balances">
      <div>
        <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">Treasury SOL · on-chain</div>
        <div className="font-display text-[16px] font-black text-green" data-testid="live-wallet-sol">{w?.balance_sol != null ? sol(w.balance_sol, 4) : '—'}</div>
        <div className="text-[9.5px] text-dim2">{w?.balance_sol != null ? usd(w.balance_usd, 2) : 'RPC unavailable'}</div>
      </div>
      <div>
        <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">Treasury $BASH · on-chain</div>
        <div className="font-display text-[16px] font-black text-green" data-testid="live-wallet-bash">{w?.token_balance != null ? compact(w.token_balance) : '—'}</div>
        <div className="text-[9.5px] text-dim2">{w?.token_balance != null ? `${sol(w.token_value_sol, 4)} · ${usd(w.token_value_usd, 2)}` : ''}</div>
      </div>
      <a href={w?.solscan_url} target="_blank" rel="noreferrer" className="col-span-2 flex items-center gap-1 text-[10px] text-dim hover:text-green" data-testid="live-signer-link">
        Signer {short(live?.signer_wallet || '')} <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
};

export const LiveBuybackPanel = ({ data }) => {
  const { data: live, refetch } = useLiveStatus();
  const { guard, isDirector } = useDirectorGuard();
  const refresh = useRefresh();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState(null);
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const intent = live?.pending_intent || data.live?.pending_intent;
  const pk = publicKey?.toBase58();
  const signerOk = !!pk && pk === live?.signer_wallet;
  const floor = live?.min_wallet_balance_sol ?? 0.05;
  const maxBuy = live?.wallet?.balance_sol != null && intent ? Math.max(0, Math.min(intent.amount_sol, live.wallet.balance_sol - floor)) : intent?.amount_sol || 0;

  useEffect(() => {
    if (intent) setAmount((maxBuy > 0 ? maxBuy : intent.amount_sol).toFixed(4));
  }, [intent?.id, intent?.amount_sol, maxBuy]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestRelease = guard(async () => {
    try { const r = await injectNow(); refresh(); refetch(); toast(r.status === 'awaiting_signature' ? `Governor released ${sol(r.amount_sol)} — ready to sign` : r.status === 'delayed' ? 'Governor: window cap reached — delayed' : `Reserve ${sol(r.reserve_sol, 4)} is below the ${r.min_injection_sol} SOL minimum`); } catch (e) { toast.error(errMsg(e)); }
  });

  const dismiss = guard(async () => {
    try { await liveDismiss(intent.id); refetch(); refresh(); toast('Release dismissed · reserve untouched'); } catch (e) { toast.error(errMsg(e)); }
  });

  const execute = guard(async () => {
    if (!connected || !signerOk) return toast.error('Connect the disclosed treasury signer wallet first');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error('Enter an amount');
    setError(''); setResult(null); setQuote(null);
    try {
      setStep('building');
      const b = await liveBuild({ intent_id: intent.id, wallet: pk, amount_sol: amt });
      setQuote(b.quote);
      setStep('signing');
      const tx = VersionedTransaction.deserialize(Buffer.from(b.swap_transaction, 'base64'));
      const signature = await sendTransaction(tx, connection, { skipPreflight: false, maxRetries: 3 });
      setStep('ledgering');
      let res = null;
      for (let i = 0; i < 10; i += 1) {
        try { res = await liveConfirm({ intent_id: intent.id, signature }); break; } catch (e) {
          if (e.response?.status === 409 && i < 9) { await sleep(4000); continue; }
          throw e;
        }
      }
      setResult(res);
      toast.success(`BUYBACK EXECUTED: ${sol(res.amount_sol)} → ${compact(res.tokens_acquired)} $BASH on-chain`);
      refresh(); refetch();
    } catch (e) {
      const m = errMsg(e) || e.message;
      setError(m);
      toast.error(m);
    } finally {
      setStep(null);
    }
  });

  return (
    <Panel className="p-5 space-y-4 border-green/50 animate-glow" data-testid="live-buyback-panel">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-green animate-pulse" /> Treasury buyback · on-chain</Eyebrow>
        <Tag tone="green" data-testid="live-mode-tag">LIVE · Director-signed</Tag>
      </div>

      <Balances live={live} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="wallet-btn" data-testid="live-wallet-connect"><WalletMultiButton /></div>
        {!isDirector && <span className="text-[9.5px] text-amber">Director login required to sign</span>}
      </div>

      {connected && (
        <div className={`flex items-center gap-2 text-[10.5px] rounded-sm border p-2.5 ${signerOk ? 'border-green/40 bg-green/10 text-green' : 'border-red/40 bg-red/10 text-red'}`} data-testid="live-signer-check">
          {signerOk ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {signerOk ? `Treasury signer connected · ${short(pk)}` : `Connected ${short(pk)} is not the disclosed treasury signer ${short(live?.signer_wallet || '')}`}
        </div>
      )}

      {intent ? (
        <div className="space-y-3 border border-green/30 bg-green/5 rounded-sm p-3" data-testid="live-intent-card">
          <div className="flex items-center justify-between">
            <div className="text-[9.5px] uppercase tracking-[1.5px] text-green font-bold">Governor released · awaiting signature</div>
            <span className="text-[9.5px] text-dim2">{timeAgo(intent.created_at)} · {intent.trigger} · window closes {hhmm(intent.expires_at)}</span>
          </div>
          <div className="font-display text-2xl font-black" data-testid="live-intent-amount">{sol(intent.amount_sol, 4)}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Buy amount (max ${maxBuy.toFixed(4)} SOL after ${floor} SOL floor)`}>
              <input type="number" step="0.001" min="0" max={maxBuy || intent.amount_sol} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} data-testid="live-amount-input" />
            </Field>
            <div className="text-[10px] text-dim leading-relaxed self-end pb-1">Route: Jupiter → pump.fun curve · max slippage {live?.max_slippage_bps} bps · signature required from {short(live?.signer_wallet || '')}</div>
          </div>
          {step && <div className="flex items-center gap-2 text-[11px] text-green" data-testid="live-step"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> {STEPS[step]}</div>}
          {quote && !result && <div className="text-[10px] text-dim">Quote: ~{compact(quote.out_tokens)} $BASH · impact {pct(quote.price_impact_pct)} · via {quote.route.join(' → ')}</div>}
          {error && <div className="text-[10.5px] text-red border border-red/40 bg-red/10 rounded-sm p-2" data-testid="live-error">{error}</div>}
          {result && (
            <div className="text-[10.5px] text-green border border-green/40 bg-green/10 rounded-sm p-2 space-y-0.5" data-testid="live-result">
              <div className="font-bold">Executed on-chain: {sol(result.amount_sol)} → {compact(result.tokens_acquired)} $BASH</div>
              <a href={`https://solscan.io/tx/${result.tx_signature}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">{short(result.tx_signature, 12, 8)} <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
          <div className="flex gap-2">
            <Btn variant="green" disabled={!!step || !connected || !signerOk || maxBuy <= 0} onClick={execute} data-testid="live-execute-btn"><Zap className="h-3.5 w-3.5" /> Quote, sign &amp; buy</Btn>
            <Btn variant="ghost" disabled={!!step} onClick={dismiss} data-testid="live-dismiss-btn"><XCircle className="h-3.5 w-3.5" /> Dismiss</Btn>
          </div>
          {maxBuy <= 0 && live?.wallet?.balance_sol != null && <div className="text-[10px] text-amber" data-testid="live-fund-notice">Treasury wallet holds {sol(live.wallet.balance_sol, 4)} — fund it above the {floor} SOL floor to execute.</div>}
        </div>
      ) : (
        <div className="border border-line-subtle rounded-sm p-3 text-[10.5px] text-dim space-y-2" data-testid="live-no-intent">
          <div>No buyback released right now. The governor releases one when the reserve is above {live?.min_injection_sol ?? 0.005} SOL and the current window has capacity.</div>
          <Btn variant="ghost" onClick={requestRelease} data-testid="live-request-release-btn">Ask governor for a release</Btn>
        </div>
      )}

      {live?.recent?.length > 0 && (
        <div className="space-y-1.5" data-testid="live-recent">
          <Eyebrow>On-chain buybacks · {live.injections_count} · {sol(live.sol_spent, 4)} · {compact(live.tokens_acquired)} $BASH</Eyebrow>
          {live.recent.slice(0, 5).map((e) => (
            <a key={e.id} href={`https://solscan.io/tx/${e.tx_signature}`} target="_blank" rel="noreferrer" className="flex items-center justify-between text-[10px] border border-line-subtle rounded-sm px-2.5 py-1.5 hover:border-green/50">
              <span className="text-green font-bold">{sol(e.amount_sol)} → {compact(e.tokens_acquired)} $BASH</span>
              <span className="text-dim2 flex items-center gap-1">{short(e.tx_signature, 8, 6)} <ExternalLink className="h-3 w-3" /></span>
            </a>
          ))}
        </div>
      )}
    </Panel>
  );
};
