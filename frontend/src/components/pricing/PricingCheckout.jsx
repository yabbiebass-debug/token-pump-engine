import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Check, Copy, Wallet, CheckCircle2, ArrowRight, Flame, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import { Eyebrow, Panel, Btn, Tag, Field, inputCls } from '@/components/kit/Primitives';
import { useMeta, useFlywheel, useRefresh } from '@/hooks/useData';
import { useSolTransfer } from '@/lib/solana';
import { createPayment, verifySol, errMsg } from '@/lib/api';
import { PROMO_CODE, SOL_RECIPIENT } from '@/lib/constants';
import { copyText } from '@/lib/clipboard';
import { usd, sol, short, compact } from '@/lib/format';

const PackageCard = ({ p, selected, onSelect }) => (
  <button onClick={onSelect} data-testid={`pkg-${p.name.toLowerCase()}`}
    className={`text-left border rounded-sm p-4 transition-[border-color,box-shadow] ${selected ? 'border-purple bg-purple/10 shadow-[0_0_20px_rgba(153,69,255,0.25)]' : 'border-line bg-panel hover:border-purple/50'}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="font-display text-[14px] font-black">{p.name}</div>
      <Tag tone={p.popular ? 'green' : 'dim'}>{p.badge}</Tag>
    </div>
    <div className="font-display text-[22px] font-black">{usd(p.fee)}</div>
    <div className="text-[10px] text-dim2 mb-2">{p.turnaround}</div>
    <p className="text-[10.5px] text-dim leading-relaxed mb-3">{p.description}</p>
    <ul className="space-y-1">
      {p.features.slice(0, 4).map((f) => <li key={f} className="flex gap-1.5 text-[10px] text-dim"><Check className="h-3 w-3 text-green shrink-0 mt-0.5" />{f}</li>)}
    </ul>
  </button>
);

const Success = ({ result, onReset }) => {
  const navigate = useNavigate();
  const { payment, client, flywheel } = result;
  const inj = flywheel.injection;
  return (
    <Panel className="p-6 sm:p-8 max-w-3xl mx-auto space-y-6 animate-fade-up" data-testid="checkout-success">
      <div className="flex items-center gap-3 text-green">
        <CheckCircle2 className="h-6 w-6" />
        <div>
          <div className="font-display text-[16px] font-black">Payment verified on-chain · build queued</div>
          <div className="text-[10px] text-dim uppercase tracking-[1.5px]">{sol(payment.sol_amount)} received · slot {payment.slot}</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 text-[11px]">
        <div className="border border-line-subtle bg-void/60 p-4 rounded-sm space-y-1.5">
          <Eyebrow>Client record</Eyebrow>
          <div className="text-ink font-bold">{client.biz}</div>
          <div className="text-dim">{client.package} · {client.tier} tier · {usd(client.setup_fee)} paid in SOL</div>
          <div className="text-dim">Status: <span className="text-amber">{client.status}</span> · the Director picks it up next</div>
          <div className="text-dim">{sol(payment.sol_amount)} → {short(payment.recipient)} <a href={`https://solscan.io/tx/${payment.tx_signature}`} target="_blank" rel="noreferrer" className="ml-1 text-green hover:underline inline-flex items-center gap-1" data-testid="checkout-tx-link">tx <ExternalLink className="h-3 w-3" /></a></div>
        </div>
        <div className="border border-purple/40 bg-purple/10 p-4 rounded-sm space-y-1.5" data-testid="checkout-flywheel-result">
          <Eyebrow className="text-purple flex items-center gap-1"><Flame className="h-3 w-3" /> Flywheel allocation</Eyebrow>
          <div className="text-ink font-bold">{sol(flywheel.allocation.amount_sol)} <span className="text-dim font-normal">({Math.round(flywheel.allocation.pct * 100)}% of your SOL)</span></div>
          <div className="text-dim">Buyback reserve now {sol(flywheel.allocation.reserve_after, 4)}</div>
          {inj.status === 'awaiting_signature' && <div className="text-green">Governor released {sol(inj.amount_sol)} — awaiting Director signature</div>}
          {inj.status === 'delayed' && <div className="text-red">Governor: window cap reached · {sol(inj.amount_sol, 3)} delayed</div>}
          {inj.status === 'below_min' && <div className="text-dim">Below minimum buyback · pooled until the reserve reaches {inj.min_injection_sol} SOL</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Btn variant="green" onClick={() => navigate('/mission')} data-testid="checkout-goto-mission">Open Mission Control <ArrowRight className="h-3.5 w-3.5" /></Btn>
        <Btn variant="primary" onClick={() => navigate('/transparency')} data-testid="checkout-goto-flywheel">See the public ledger</Btn>
        <Btn variant="ghost" onClick={onReset} data-testid="checkout-another">Start another build</Btn>
      </div>
    </Panel>
  );
};

export const PricingCheckout = () => {
  const [params] = useSearchParams();
  const { data: meta } = useMeta();
  const { data: fly } = useFlywheel();
  const refresh = useRefresh();
  const { transfer, connected, address } = useSolTransfer();
  const packages = meta?.packages || [];
  const tiers = meta?.tiers || [];

  const [pkg, setPkg] = useState(params.get('pkg') || 'Merge');
  const [customFee, setCustomFee] = useState(2500);
  const [tier, setTier] = useState('Upstream');
  const [form, setForm] = useState({ biz: '', email: '', phone: '', scope: params.get('scope') || '' });
  const [promo, setPromo] = useState(localStorage.getItem('pulse_voucher') || '');
  const [solSig, setSolSig] = useState('');
  const [solVerify, setSolVerify] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const pkgObj = packages.find((p) => p.name === pkg);
  const tierObj = tiers.find((t) => t.name === tier);
  const rawFee = pkg === 'Custom' ? Number(customFee) || 0 : pkgObj?.fee || 0;
  const discount = promo.trim().toUpperCase() === PROMO_CODE ? 250 : 0;
  const fee = Math.max(100, rawFee - discount);
  const solPrice = fly?.derived?.sol_price_usd || 100;
  const buybackPct = fly?.config?.buyback_pct ?? 0.15;
  const solAmount = useMemo(() => fee / solPrice, [fee, solPrice]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const copyAddr = async () => { if (await copyText(SOL_RECIPIENT)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  const verify = async (sig) => {
    setVerifying(true);
    try {
      const v = await verifySol(sig.trim(), solAmount);
      setSolVerify(v);
      if (v.valid) toast.success(`Verified on-chain · ${v.received_sol.toFixed(4)} SOL received`);
      else toast.error(v.reason);
      return v;
    } catch (e) { toast.error(errMsg(e)); return null; } finally { setVerifying(false); }
  };

  const payWithWallet = async () => {
    if (!form.biz.trim()) return toast.error('Business / project name is required before paying');
    setPaying(true);
    try {
      const sig = await transfer(SOL_RECIPIENT, solAmount);
      setSolSig(sig);
      toast(`Transfer sent · ${short(sig, 10, 6)} — verifying…`);
      await verify(sig);
    } catch (e) { toast.error(e?.message || 'Wallet transfer failed'); } finally { setPaying(false); }
  };

  const submit = async () => {
    if (!form.biz.trim()) return toast.error('Business / project name is required');
    if (!solVerify?.valid) return toast.error('Verify your SOL transfer on-chain before confirming');
    setBusy(true);
    try {
      const res = await createPayment({ ...form, package: pkg, custom_fee: pkg === 'Custom' ? Number(customFee) : null, tier, promo_code: promo, sol_signature: solSig.trim(), payer_wallet: address });
      setResult(res);
      refresh();
      toast.success(`Payment verified for ${res.payment.biz} · ${res.flywheel.allocation.amount_sol.toFixed(4)} SOL → buyback reserve`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  if (result) return <Success result={result} onReset={() => { setResult(null); setSolSig(''); setSolVerify(null); }} />;

  return (
    <div className="space-y-10" id="pricing-section">
      <div>
        <Eyebrow className="text-purple">Fixed-price builds · paid in SOL</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl font-black mt-1">Pick a path. Pay in SOL. <span className="text-green">Feed the flywheel.</span></h1>
        <p className="text-dim text-sm mt-3 max-w-2xl">SOL is the only way to pay. Your transfer is read back from Solana mainnet and accepted when the treasury received at least 97% of the quote. {Math.round(buybackPct * 100)}% of every verified payment is earmarked for $BASH buybacks that the Director signs on-chain.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4 stagger">
        {packages.map((p) => <PackageCard key={p.name} p={p} selected={pkg === p.name} onSelect={() => setPkg(p.name)} />)}
        <button onClick={() => setPkg('Custom')} data-testid="pkg-custom"
          className={`text-left border rounded-sm p-4 transition-colors ${pkg === 'Custom' ? 'border-amber bg-amber/10' : 'border-dashed border-line bg-panel hover:border-amber/50'}`}>
          <div className="font-display text-[14px] font-black mb-2">Custom scope</div>
          <Field label="Fee (USD, min $500)">
            <input type="number" min={500} step={100} value={customFee} onChange={(e) => setCustomFee(e.target.value)} className={inputCls} onClick={(e) => e.stopPropagation()} data-testid="pkg-custom-fee" />
          </Field>
          <p className="text-[10.5px] text-dim mt-3">Multi-repo programs, platform ports, or a niche nobody has touched. Scoped with the Director.</p>
        </button>
      </div>

      <div>
        <Eyebrow className="mb-3">Monthly stewardship tier</Eyebrow>
        <div className="grid gap-3 md:grid-cols-3">
          {tiers.map((t) => (
            <button key={t.name} onClick={() => setTier(t.name)} data-testid={`tier-${t.name.toLowerCase()}`}
              className={`text-left border rounded-sm p-4 transition-colors ${tier === t.name ? 'border-green bg-green/10' : 'border-line bg-panel hover:border-green/40'}`}>
              <div className="flex items-center justify-between"><div className="font-display text-[13px] font-black">{t.name}</div><div className="font-display text-[13px] font-black text-green">{usd(t.mrr)}<span className="text-[9px] text-dim">/mo</span></div></div>
              <p className="text-[10.5px] text-dim mt-1.5">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7 p-5 space-y-4">
          <Eyebrow>Project details</Eyebrow>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Business / community *"><input value={form.biz} onChange={set('biz')} className={inputCls} placeholder="Your project or community" data-testid="checkout-biz" /></Field>
            <Field label="Email"><input value={form.email} onChange={set('email')} className={inputCls} placeholder="you@niche.org" data-testid="checkout-email" /></Field>
            <Field label="Phone"><input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="+1 …" data-testid="checkout-phone" /></Field>
            <Field label="Promo code" hint={discount ? 'PULSE250 applied · −$250' : 'Win PULSE250 in the Pulse game'}>
              <input value={promo} onChange={(e) => setPromo(e.target.value)} className={inputCls} placeholder="PULSE250" data-testid="checkout-promo" />
            </Field>
          </div>
          <Field label="Scope notes"><textarea rows={3} value={form.scope} onChange={set('scope')} className={inputCls + ' resize-none'} placeholder="What should the product do? Which repos do you already like?" data-testid="checkout-scope" /></Field>

          <div className="space-y-3 border border-green/30 bg-green/5 p-3 rounded-sm" data-testid="sol-checkout-panel">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[1.5px] text-green font-bold flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> 1 · Send {sol(solAmount, 4)} to the treasury</div>
              <div className="wallet-btn" data-testid="checkout-wallet-connect"><WalletMultiButton /></div>
            </div>
            <div className="flex items-center gap-2 text-[10.5px] font-mono break-all">
              <span className="text-ink" data-testid="sol-recipient">{SOL_RECIPIENT}</span>
              <button onClick={copyAddr} className="text-dim hover:text-green shrink-0" data-testid="sol-copy-btn">{copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}</button>
            </div>
            {connected && (
              <Btn variant="green" onClick={payWithWallet} disabled={paying || verifying} className="w-full" data-testid="sol-pay-wallet-btn">
                {paying ? 'Approve in your wallet…' : `Pay ${sol(solAmount, 4)} from ${short(address)}`}
              </Btn>
            )}
            <div className="text-[10px] uppercase tracking-[1.5px] text-green font-bold pt-1">2 · {connected ? 'Or paste' : 'Paste'} the transaction signature and verify on-chain</div>
            <div className="flex gap-2">
              <input value={solSig} onChange={(e) => { setSolSig(e.target.value); setSolVerify(null); }} className={inputCls} placeholder="87–88 character transaction signature" data-testid="sol-signature" />
              <Btn variant="ghost" onClick={() => verify(solSig)} disabled={verifying || solSig.trim().length < 64} data-testid="sol-verify-btn" className="shrink-0">{verifying ? 'Checking…' : 'Verify'}</Btn>
            </div>
            {solVerify && (
              <div className={`flex items-start gap-2 text-[10.5px] rounded-sm border p-2.5 ${solVerify.valid ? 'border-green/40 bg-green/10 text-green' : 'border-red/40 bg-red/10 text-red'}`} data-testid="sol-verify-result">
                {solVerify.valid ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
                <div>
                  <div className="font-bold">{solVerify.reason}</div>
                  <div className="text-[9.5px] opacity-80 mt-0.5">received {Number(solVerify.received_sol).toFixed(4)} SOL · quoted {Number(solVerify.expected_sol).toFixed(4)} SOL · min {Math.round(solVerify.min_ratio * 100)}%{solVerify.slot ? ` · slot ${solVerify.slot}` : ''}</div>
                </div>
              </div>
            )}
            <div className="text-[9.5px] text-dim2">The backend reads the transaction from Solana mainnet and confirms the treasury balance rose by at least 97% of the quote. Each signature can only be used once.</div>
          </div>
        </Panel>

        <Panel className="lg:col-span-5 p-5 space-y-4 scanline" data-testid="checkout-summary">
          <Eyebrow>Order summary</Eyebrow>
          <div className="space-y-2 text-[11.5px]">
            <div className="flex justify-between"><span className="text-dim">{pkg} build</span><span>{usd(rawFee)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green"><span>PULSE250 voucher</span><span>−{usd(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-dim">{tierObj?.name} tier (from month 2)</span><span>{usd(tierObj?.mrr || 0)}/mo</span></div>
            <div className="border-t border-line-subtle pt-2 flex justify-between font-display font-black text-[16px]"><span>Due today</span><span data-testid="checkout-total">{usd(fee)}</span></div>
            <div className="flex justify-between text-[11px]"><span className="text-dim">In SOL @ {usd(solPrice, 2)}</span><span className="text-green font-bold" data-testid="checkout-sol-total">{sol(solAmount, 4)}</span></div>
          </div>
          <div className="border border-purple/40 bg-purple/10 rounded-sm p-3 text-[11px] space-y-1" data-testid="checkout-flywheel-preview">
            <div className="flex items-center gap-1.5 text-purple font-bold uppercase tracking-[1.5px] text-[9.5px]"><Flame className="h-3 w-3" /> Flywheel preview</div>
            <div className="flex justify-between"><span className="text-dim">{Math.round(buybackPct * 100)}% earmarked for buybacks</span><span className="text-purple">{sol(solAmount * buybackPct)}</span></div>
            <div className="text-[10px] text-dim2 pt-1">The governor releases it for a Director-signed on-chain buy when the window has capacity; otherwise it waits for the next window.</div>
          </div>
          <Btn variant="green" className="w-full py-3" onClick={submit} disabled={busy || !solVerify?.valid} data-testid="checkout-confirm-btn">
            {busy ? 'Confirming…' : solVerify?.valid ? `Confirm verified SOL payment · ${usd(fee)}` : 'Verify SOL transfer first'}
          </Btn>
          <div className="text-[9.5px] text-dim2 text-center">Real SOL, verified on Solana mainnet. A client record, ledger entry, and flywheel allocation are created only after verification.</div>
        </Panel>
      </div>
    </div>
  );
};
