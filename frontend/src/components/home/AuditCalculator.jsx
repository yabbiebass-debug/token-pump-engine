import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, ArrowRight } from 'lucide-react';
import { Eyebrow, Panel, Btn, Field, inputCls, Tag } from '@/components/kit/Primitives';
import { NICHES, INDUSTRY_DEFAULTS, calculateAudit } from '@/lib/constants';
import { usd, num } from '@/lib/format';

const Range = ({ label, value, min, max, step = 1, onChange, fmt, testId }) => (
  <Field label={`${label}: ${fmt(value)}`}>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" data-testid={testId} />
  </Field>
);

export const AuditCalculator = () => {
  const navigate = useNavigate();
  const [industry, setIndustry] = useState('Recreation & Outdoors');
  const def = INDUSTRY_DEFAULTS[industry];
  const [leads, setLeads] = useState(def.typicalLeads);
  const [deal, setDeal] = useState(def.avgDeal);
  const [hours, setHours] = useState(def.hoursAdmin);
  const r = useMemo(() => calculateAudit(industry, leads, deal, hours), [industry, leads, deal, hours]);

  const pickIndustry = (v) => {
    const d = INDUSTRY_DEFAULTS[v];
    setIndustry(v); setLeads(d.typicalLeads); setDeal(d.avgDeal); setHours(d.hoursAdmin);
  };

  return (
    <section id="audit-section" className="mx-auto max-w-7xl px-4 sm:px-6 py-16" data-testid="audit-calculator">
      <div className="mb-6">
        <Eyebrow className="text-purple">60-second opportunity scan</Eyebrow>
        <h2 className="font-display text-base md:text-lg font-black mt-1">What is the missing tool costing your niche?</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-5 p-5 space-y-5">
          <Field label="Niche">
            <select value={industry} onChange={(e) => pickIndustry(e.target.value)} className={inputCls} data-testid="audit-industry-select">
              {NICHES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Range label="Reachable users / month" value={leads} min={50} max={5000} step={50} onChange={setLeads} fmt={(v) => num(v)} testId="audit-leads-range" />
          <Range label="What a paid tier can charge" value={deal} min={5} max={200} step={5} onChange={setDeal} fmt={(v) => usd(v)} testId="audit-deal-range" />
          <Range label="Hours / week hand-rolling tools" value={hours} min={1} max={60} onChange={setHours} fmt={(v) => `${v}h`} testId="audit-hours-range" />
          <div className="text-[10px] text-dim2 leading-relaxed">Assumes a 4% paid-conversion rate, $65/hr builder time, and 80% of hours saved by forking instead of starting blank.</div>
        </Panel>
        <Panel className="lg:col-span-7 p-5 space-y-5 scanline" data-testid="audit-results">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple font-display text-[12px] font-black"><Calculator className="h-4 w-4" /> Blueprint · {r.systemName}</div>
            <Tag tone="amber">Recommended: {r.recommendedPackage}</Tag>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Annual revenue leak', usd(r.annualLostRevenue), 'text-red'],
              ['Annual time cost', usd(r.annualTimeCost), 'text-amber'],
              ['Hours reclaimed / yr', num(r.hoursReclaimedPerYear), 'text-green'],
              ['ROI multiple', `${r.roiMultiplier}×`, 'text-green'],
            ].map(([l, v, t]) => (
              <div key={l}>
                <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold">{l}</div>
                <div className={`font-display text-[18px] font-black ${t}`}>{v}</div>
              </div>
            ))}
          </div>
          <div className="border border-line-subtle bg-void/60 p-4 rounded-sm text-[11px] text-dim leading-relaxed space-y-1.5 font-mono">
            <div><span className="text-purple">Day 1–3</span> · SCOUT and FORGE pick the best upstream repos for {industry} and clear their licenses.</div>
            <div><span className="text-purple">Day 4–8</span> · BUILDER forks, merges, and adapts — rebrand, niche defaults, missing features, integrations.</div>
            <div><span className="text-purple">Day 9–14</span> · SHIPPER cuts the release, publishes docs and demo, and wires the paid tier behind a Director gate.</div>
            <div><span className="text-green">Flywheel</span> · {usd(r.buybackContribution)} of the {r.recommendedPackage} fee is routed to the $BASH buyback reserve on payment.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {r.integrations.map((i) => <Tag key={i} tone="dim">{i}</Tag>)}
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            <Btn variant="green" onClick={() => navigate(`/pricing?pkg=${r.recommendedPackage}&scope=${encodeURIComponent(`${r.systemName} for ${industry}`)}`)} data-testid="audit-select-package-btn">
              Lock in {r.recommendedPackage} <ArrowRight className="h-3.5 w-3.5" />
            </Btn>
            <Btn variant="ghost" onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })} data-testid="audit-try-agents-btn">Test-drive the agents</Btn>
          </div>
        </Panel>
      </div>
    </section>
  );
};
