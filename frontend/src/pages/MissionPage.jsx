import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play } from 'lucide-react';
import { useAppState, useFlywheel, useVault, useRefresh } from '@/hooks/useData';
import { runCycle, setAutoCycle, errMsg } from '@/lib/api';
import { STAGES } from '@/lib/constants';
import { Panel, Eyebrow, Btn } from '@/components/kit/Primitives';
import { KpiBar } from '@/components/mission/KpiBar';
import { CycleRing } from '@/components/mission/CycleRing';
import { AgentSwarm } from '@/components/mission/AgentSwarm';
import { PipelineTab } from '@/components/mission/PipelineTab';
import { ClientsTab } from '@/components/mission/ClientsTab';
import { CycleLogTab } from '@/components/mission/CycleLogTab';
import { TreasuryTab } from '@/components/mission/TreasuryTab';
import { WiringTab } from '@/components/mission/WiringTab';

const TABS = ['Pipeline', 'Clients', 'Cycle Log', 'Treasury', 'Model & Wiring'];

export default function MissionPage() {
  const { data, isLoading } = useAppState();
  const { data: fly } = useFlywheel();
  const { data: vault } = useVault();
  const refresh = useRefresh();
  const [tab, setTab] = useState('Pipeline');
  const [activeStage, setActiveStage] = useState(null);
  const [running, setRunning] = useState(false);
  const lastCycle = useRef(null);

  const animate = () =>
    new Promise((resolve) => {
      let i = 0;
      setActiveStage(0);
      const iv = setInterval(() => {
        i += 1;
        if (i < STAGES.length) setActiveStage(i);
        else { clearInterval(iv); setActiveStage(null); resolve(); }
      }, 420);
    });

  useEffect(() => {
    const n = data?.state?.cycles_count;
    if (n == null) return;
    if (lastCycle.current !== null && n > lastCycle.current && !running) animate();
    lastCycle.current = n;
  }, [data?.state?.cycles_count]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRun = async () => {
    if (running) return;
    setRunning(true);
    try {
      const [res] = await Promise.all([runCycle(), animate()]);
      lastCycle.current = res.cycle_n;
      refresh();
      toast.success(`Cycle #${res.cycle_n} complete · ${res.taps_sol.toFixed(4)} SOL tapped → reserve · injection ${res.injection.status}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRunning(false);
    }
  };

  const onToggleAuto = async () => {
    try {
      const st = await setAutoCycle(!data.state.auto_cycle);
      refresh();
      toast(st.auto_cycle ? 'Auto-cycle ON · server runs a cycle every 60s' : 'Auto-cycle OFF');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (isLoading || !data) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-dim text-[12px]" data-testid="mission-loading">Booting Mission Control…</div>;
  }

  return (
    <div className="pb-16" data-testid="mission-page">
      <KpiBar data={data} fly={fly} vault={vault} onRun={onRun} onToggleAuto={onToggleAuto} running={running} activeStage={activeStage} onWithdraw={() => setTab('Treasury')} />
      <div className="mx-auto max-w-7xl p-4 sm:p-6 grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-3 space-y-4">
          <Panel className="p-4">
            <Eyebrow className="mb-3 flex items-center justify-between">
              <span>Autonomous loop</span>
              <span className="text-purple font-mono">{activeStage !== null ? STAGES[activeStage] : 'IDLE'}</span>
            </Eyebrow>
            <CycleRing cycles={data.state.cycles_count} activeStage={activeStage} />
            <p className="mt-3 text-[10.5px] text-dim leading-relaxed text-center">
              Amber keys are Director gates. Every stage taps <span className="text-purple">{((fly?.config?.stage_tap_pct || 0) * 100).toFixed(2)}%</span> of MRR into the $BASH reserve; REINVEST triggers the INJECTOR.
            </p>
            <Btn variant="primary" className="w-full mt-3 lg:hidden" onClick={onRun} disabled={running} data-testid="run-cycle-btn-mobile"><Play className="h-3 w-3" /> Run cycle</Btn>
          </Panel>
          <AgentSwarm />
        </aside>

        <section className="lg:col-span-9 space-y-4">
          <div className="flex flex-wrap gap-1 border-b border-line" data-testid="mission-tabs">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} data-testid={`mission-tab-${t.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                className={`px-4 py-2 text-[10.5px] uppercase tracking-[1.5px] border-b-2 -mb-px transition-colors ${tab === t ? 'border-purple text-ink' : 'border-transparent text-dim hover:text-ink'}`}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'Pipeline' && <PipelineTab leads={data.leads} approvals={data.approvals} />}
          {tab === 'Clients' && <ClientsTab clients={data.clients} />}
          {tab === 'Cycle Log' && <CycleLogTab events={data.events} />}
          {tab === 'Treasury' && <TreasuryTab payments={data.payments} withdrawals={data.withdrawals} vault={vault} fly={fly} />}
          {tab === 'Model & Wiring' && <WiringTab fly={fly} />}
        </section>
      </div>
    </div>
  );
}
