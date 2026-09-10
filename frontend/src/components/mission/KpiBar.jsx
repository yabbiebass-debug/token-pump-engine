import React from 'react';
import { Play, Lock } from 'lucide-react';
import { Stat, Btn } from '@/components/kit/Primitives';
import { usd, sol } from '@/lib/format';

export const KpiBar = ({ data, fly, vault, onRun, onToggleAuto, running, activeStage, onWithdraw, isDirector }) => {
  const pending = data.approvals.filter((a) => a.status === 'pending').length;
  const mrr = data.clients.reduce((a, c) => a + (c.mrr || 0), 0);
  const cashIn = data.payments.filter((p) => p.status === 'confirmed').reduce((a, p) => a + (p.amount_usd || 0), 0);
  const openLeads = data.leads.filter((l) => !['LOST', 'SUPPORT'].includes(l.stage)).length;
  return (
    <header className="border-b border-line bg-panel2/80 px-4 py-3 sm:px-6 sticky top-[60px] z-30 backdrop-blur-md" data-testid="mission-kpi-bar">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display text-[15px] font-black tracking-[0.5px] flex items-center gap-2">
            <span className="text-purple">YABBAI</span> MISSION CONTROL
            <span className="text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded bg-green/10 text-green border border-green/30">System online</span>
          </div>
          <div className="text-[9.5px] uppercase tracking-[2px] text-dim">Basham Automations · open-source foundry · $BASH flywheel</div>
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <Stat label="MRR" value={usd(mrr)} tone="text-green" testId="kpi-mrr" />
          <Stat label="Total cash in" value={usd(cashIn)} tone="text-green" testId="kpi-cash" />
          <Stat label="Active builds" value={data.clients.length} testId="kpi-builds" />
          <Stat label="Open leads" value={openLeads} tone="text-purple" testId="kpi-leads" />
          <Stat label="Gates open" value={`${pending} ⚿`} tone="text-amber" testId="kpi-gates" />
          <div data-testid="kpi-vault">
            <div className="text-[9px] uppercase tracking-[1.5px] text-dim font-bold flex items-center gap-1">Treasury SOL <span className="text-green text-[8px] bg-green/10 border border-green/30 px-1 rounded">ON-CHAIN</span></div>
            <div className="flex items-center gap-2">
              <span className="font-display text-[15px] font-black text-green">{vault?.balance_sol != null ? `${vault.balance_sol.toFixed(4)} SOL` : '—'}</span>
              <button onClick={onWithdraw} className="rounded bg-purple/20 border border-purple/50 px-2 py-0.5 text-[9px] text-purple hover:bg-purple hover:text-white uppercase font-bold transition-colors" data-testid="kpi-withdraw-btn">Transfer</button>
            </div>
          </div>
          <Stat label="Buyback reserve" value={sol(fly?.state?.buyback_reserve_sol ?? 0, 3)} tone="text-purple" testId="kpi-reserve" />
        </div>
        <div className="flex items-center gap-2.5">
          {!isDirector && <span className="hidden md:inline-flex items-center gap-1 text-[9px] uppercase tracking-[1.5px] text-amber" data-testid="kpi-locked-hint"><Lock className="h-3 w-3" /> Director controls</span>}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[10px] uppercase tracking-[1.5px] cursor-pointer transition-colors ${data.state.auto_cycle ? 'border-green bg-green/10 text-green font-bold' : 'border-line text-dim hover:text-ink'}`} data-testid="auto-cycle-toggle">
            <input type="checkbox" checked={!!data.state.auto_cycle} onChange={onToggleAuto} data-testid="auto-cycle-checkbox" />
            Auto cycle {data.state.auto_cycle ? 'ON' : 'OFF'}
          </label>
          <Btn variant="primary" onClick={onRun} disabled={running} data-testid="run-cycle-btn">
            {isDirector ? <Play className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} /> : <Lock className="h-3 w-3" />} {running ? `Stage ${activeStage !== null ? activeStage + 1 : 8}/8…` : 'Run cycle'}
          </Btn>
        </div>
      </div>
    </header>
  );
};
