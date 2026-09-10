import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Copy, CreditCard, Wallet, Landmark, CheckCircle2, ArrowRight, Flame } from 'lucide-react';
import { Eyebrow, Panel, Btn, Tag, Field, inputCls } from '@/components/kit/Primitives';
import { useMeta, useFlywheel, useRefresh } from '@/hooks/useData';
import { createPayment, errMsg } from '@/lib/api';
import { PROMO_CODE, SOL_RECIPIENT } from '@/lib/constants';
import { usd, sol, short, compact } from '@/lib/format';

const METHODS = [
  { id: 'card', label: 'Card', Icon: CreditCard },
  { id: 'paypal', label: 'PayPal', Icon: Landmark },
  { id: 'solana', label: 'Solana', Icon: Wallet },
];

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

export const PricingCheckout = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: meta } = useMeta();
  const { data: fly } = useFlywheel();
  const refresh = useRefresh();
  const packages = meta?.packages || [];
  const tiers = meta?.tiers || [];

  const [pkg, setPkg] = useState(params.get('pkg') || 'Merge');
  const [customFee, setCustomFee] = useState(2500);
  const [tier, setTier] = useState('Upstream');
  const [form, setForm] = useState({ biz: '', email: '', phone: '', scope: params.get('scope') || '' });
  const [promo, setPromo] = useState(localStorage.getItem('pulse_voucher') || '');
  const [method, setMethod] = useState('card');
  const [solSig, setSolSig] = useState('');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
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

  const copyAddr = () => { navigator.clipboard.writeText(SOL_RECIPIENT); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const submit = async () => {
    if (!form.biz.trim()) return toast.error('Business / project name is required');
    if (method === 'card' && card.number.replace(/\s/g, '').length < 12) return toast.error('Enter a demo card number (any 12+ digits)');
    setBusy(true);
    try {
      const res = await createPayment({ ...form, package: pkg, custom_fee: pkg === 'Custom' ? Number(customFee) : null, tier, method, promo_code: promo, sol_signature: solSig });
      setResult(res);
      refresh();
      toast.success(`Payment confirmed for ${res.payment.biz} · ${res.flywheel.allocation.amount_sol.toFixed(4)} SOL → buyback reserve`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const { payment, client, flywheel } = result;
    const inj = flywheel.injection;
    return (
      <Panel className="p-6 sm:p-8 max-w-3xl mx-auto space-y-6 animate-fade-up" data-testid="checkout-success">
        <div className="flex items-center gap-3 text-green">
          <CheckCircle2 className="h-6 w-6" />
          <div>
            <div className="font-display text-[16px] font-black">Payment confirmed · build queued</div>
            <div className="text-[10px] text-dim uppercase tracking-[1.5px]">Demo checkout · no real charge · ref {payment.reference}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-[11px]">
          <div className="border border-line-subtle bg-void/60 p-4 rounded-sm space-y-1.5">
            <Eyebrow>Client record</Eyebrow>
            <div className="text-ink font-bold">{client.biz}</div>
            <div className="text-dim">{client.package} · {client.tier} tier · {usd(client.setup_fee)} paid via {payment.method}</div>
            <div className="text-dim">Status: <span className="text-amber">{client.status}</span> · build 0% → BUILDER picks it up next cycle</div>
            {payment.sol_amount && <div className="text-dim">{sol(payment.sol_amount)} → {short(payment.recipient)}</div>}
          </div>
          <div className="border border-purple/40 bg-purple/10 p-4 rounded-sm space-y-1.5" data-testid="checkout-flywheel-result">
            <Eyebrow className="text-purple flex items-center gap-1"><Flame className="h-3 w-3" /> Flywheel allocation</Eyebrow>
            <div className="text-ink font-bold">{sol(flywheel.allocation.amount_sol)} <span className="text-dim font-normal">({Math.round(flywheel.allocation.pct * 100)}% · {usd(flywheel.allocation.amount_usd)})</span></div>
            <div className="text-dim">Reserve now {sol(flywheel.allocation.reserve_after, 3)}</div>
            {inj.status === 'injected' && <div className="text-green">Injected {sol(inj.amount_sol)} → {compact(inj.tokens_acquired)} $BASH (+{inj.impact_pct.toFixed(2)}%)</div>}
            {inj.status === 'delayed' && <div className="text-red">Governor: cap reached · {sol(inj.amount_sol, 3)} delayed to next window</div>}
            {inj.status === 'below_min' && <div className="text-dim">Below minimum injection · pooled for next window</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Btn variant="green" onClick={() => navigate('/mission')} data-testid="checkout-goto-mission">Open Mission Control <ArrowRight className="h-3.5 w-3.5" /></Btn>
          <Btn variant="primary" onClick={() => navigate('/flywheel')} data-testid="checkout-goto-flywheel">See the injection ledger</Btn>
          <Btn variant="ghost" onClick={() => setResult(null)} data-testid="checkout-another">Start another build</Btn>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-10" id="pricing-section">
      <div>
        <Eyebrow className="text-purple">Fixed-price builds</Eyebrow>
        <h1 className="font-display text-4xl sm:text-5xl font-black mt-1">Pick a path. Pay once. <span className="text-green">Feed the flywheel.</span></h1>
        <p className="text-dim text-sm mt-3 max-w-2xl">{Math.round(buybackPct * 100)}% of every setup fee is converted to SOL and credited to the $BASH buyback reserve the moment the payment confirms. Checkout below is a demo gateway — no card is charged.</p>
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
            <Field label="Business / community *"><input value={form.biz} onChange={set('biz')} className={inputCls} placeholder="Trailhead Collective" data-testid="checkout-biz" /></Field>
            <Field label="Email"><input value={form.email} onChange={set('email')} className={inputCls} placeholder="you@niche.org" data-testid="checkout-email" /></Field>
            <Field label="Phone"><input value={form.phone} onChange={set('phone')} className={inputCls} placeholder="+1 …" data-testid="checkout-phone" /></Field>
            <Field label="Promo code" hint={discount ? 'PULSE250 applied · −$250' : 'Win PULSE250 in the Pulse game'}>
              <input value={promo} onChange={(e) => setPromo(e.target.value)} className={inputCls} placeholder="PULSE250" data-testid="checkout-promo" />
            </Field>
          </div>
          <Field label="Scope notes"><textarea rows={3} value={form.scope} onChange={set('scope')} className={inputCls + ' resize-none'} placeholder="What should the product do? Which repos do you already like?" data-testid="checkout-scope" /></Field>

          <Eyebrow className="pt-2">Payment method</Eyebrow>
          <div className="flex gap-2">
            {METHODS.map((m) => (
              <button key={m.id} onClick={() => setMethod(m.id)} data-testid={`pay-method-${m.id}`}
                className={`flex-1 flex items-center justify-center gap-1.5 border rounded-sm py-2 text-[10.5px] uppercase tracking-[1.5px] transition-colors ${method === m.id ? 'border-purple bg-purple/15 text-ink' : 'border-line-subtle text-dim hover:text-ink'}`}>
                <m.Icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            ))}
          </div>
          {method === 'card' && (
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2"><Field label="Card number"><input value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} className={inputCls} placeholder="4242 4242 4242 4242" data-testid="card-number" /></Field></div>
              <Field label="Exp"><input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} className={inputCls} placeholder="12/29" data-testid="card-exp" /></Field>
              <Field label="CVC"><input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} className={inputCls} placeholder="123" data-testid="card-cvc" /></Field>
            </div>
          )}
          {method === 'paypal' && <div className="text-[11px] text-dim border border-line-subtle bg-void/60 p-3 rounded-sm">Demo mode: confirming simulates a PayPal capture and records a PP-ORD reference in the Treasury ledger.</div>}
          {method === 'solana' && (
            <div className="space-y-3 border border-green/30 bg-green/5 p-3 rounded-sm">
              <div className="text-[10px] uppercase tracking-[1.5px] text-green font-bold">Send exactly {sol(solAmount, 3)} to the treasury</div>
              <div className="flex items-center gap-2 text-[10.5px] font-mono break-all">
                <span className="text-ink" data-testid="sol-recipient">{SOL_RECIPIENT}</span>
                <button onClick={copyAddr} className="text-dim hover:text-green shrink-0" data-testid="sol-copy-btn">{copied ? <Check className="h-3.5 w-3.5 text-green" /> : <Copy className="h-3.5 w-3.5" />}</button>
              </div>
              <Field label="Tx signature (optional, recorded as reference)"><input value={solSig} onChange={(e) => setSolSig(e.target.value)} className={inputCls} placeholder="paste 88-char signature" data-testid="sol-signature" /></Field>
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-5 p-5 space-y-4 scanline" data-testid="checkout-summary">
          <Eyebrow>Order summary</Eyebrow>
          <div className="space-y-2 text-[11.5px]">
            <div className="flex justify-between"><span className="text-dim">{pkg} build</span><span>{usd(rawFee)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green"><span>PULSE250 voucher</span><span>−{usd(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-dim">{tierObj?.name} tier (from month 2)</span><span>{usd(tierObj?.mrr || 0)}/mo</span></div>
            <div className="border-t border-line-subtle pt-2 flex justify-between font-display font-black text-[16px]"><span>Due today</span><span data-testid="checkout-total">{usd(fee)}</span></div>
            <div className="flex justify-between text-[10px] text-dim2"><span>≈ in SOL @ {usd(solPrice, 2)}</span><span>{sol(solAmount, 3)}</span></div>
          </div>
          <div className="border border-purple/40 bg-purple/10 rounded-sm p-3 text-[11px] space-y-1" data-testid="checkout-flywheel-preview">
            <div className="flex items-center gap-1.5 text-purple font-bold uppercase tracking-[1.5px] text-[9.5px]"><Flame className="h-3 w-3" /> Flywheel preview</div>
            <div className="flex justify-between"><span className="text-dim">{Math.round(buybackPct * 100)}% to buyback reserve</span><span className="text-ink">{usd(fee * buybackPct)}</span></div>
            <div className="flex justify-between"><span className="text-dim">Credited as</span><span className="text-purple">{sol((fee * buybackPct) / solPrice)}</span></div>
            <div className="text-[10px] text-dim2 pt-1">The INJECTOR will buy $BASH on the curve immediately if the governor window has capacity, otherwise the SOL waits for the next window.</div>
          </div>
          <Btn variant="green" className="w-full py-3" onClick={submit} disabled={busy} data-testid="checkout-confirm-btn">
            {busy ? 'Confirming…' : `Confirm demo payment · ${usd(fee)}`}
          </Btn>
          <div className="text-[9.5px] text-dim2 text-center">Demo gateway. No funds move. A client record, ledger entry, and flywheel allocation are created.</div>
        </Panel>
      </div>
    </div>
  );
};
