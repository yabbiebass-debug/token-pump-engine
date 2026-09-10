import React from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel, Eyebrow } from '@/components/kit/Primitives';
import { hhmm, usd } from '@/lib/format';

const fmtT = (t) => hhmm(t);

export const InjectionChart = ({ history }) => {
  const inj = history?.injections || [];
  const snaps = history?.snapshots || [];
  return (
    <div className="grid gap-6 md:grid-cols-2" data-testid="injection-charts">
      <Panel className="p-4">
        <Eyebrow className="mb-2 text-green">Cumulative on-chain buybacks (SOL)</Eyebrow>
        {inj.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-[11px] text-dim text-center px-6">No buybacks yet — the chart fills as the Director signs governor releases.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={inj} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14f195" stopOpacity={0.5} /><stop offset="100%" stopColor="#14f195" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" tickFormatter={fmtT} minTickGap={40} />
              <YAxis tickFormatter={(v) => v.toFixed(2)} />
              <Tooltip labelFormatter={fmtT} formatter={(v, n) => [Number(v).toFixed(4), n === 'cumulative_sol' ? 'cumulative SOL' : n]} />
              <Area type="stepAfter" dataKey="cumulative_sol" stroke="#14f195" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel className="p-4">
        <Eyebrow className="mb-2 text-amber">Live $BASH market cap (USD · snapshots)</Eyebrow>
        {snaps.length < 2 ? (
          <div className="h-[180px] flex items-center justify-center text-[11px] text-dim text-center px-6">Snapshotting every 60s — chart fills in as the feed accumulates.</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={snaps} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" tickFormatter={fmtT} minTickGap={40} />
              <YAxis domain={['auto', 'auto']} tickFormatter={(v) => usd(v)} />
              <Tooltip labelFormatter={fmtT} formatter={(v) => [usd(v, 2), 'mcap']} />
              <Line type="monotone" dataKey="market_cap_usd" stroke="#f5a623" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </div>
  );
};
