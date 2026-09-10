import React from 'react';
import { useFlywheel, useLedger, useHistory } from '@/hooks/useData';
import { TokenHeader } from '@/components/flywheel/TokenHeader';
import { FlowDiagram } from '@/components/flywheel/FlowDiagram';
import { ReservePanel } from '@/components/flywheel/ReservePanel';
import { GovernorPanel } from '@/components/flywheel/GovernorPanel';
import { CurveProgress } from '@/components/flywheel/CurveProgress';
import { InjectionChart } from '@/components/flywheel/InjectionChart';
import { LedgerTable } from '@/components/flywheel/LedgerTable';
import { ConfigPanel } from '@/components/flywheel/ConfigPanel';

export default function FlywheelPage() {
  const { data, isLoading } = useFlywheel();
  const { data: ledger } = useLedger(150);
  const { data: history } = useHistory();

  if (isLoading || !data) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-dim text-[12px]" data-testid="flywheel-loading">Spinning up the flywheel…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-6" data-testid="flywheel-page">
      <TokenHeader data={data} />
      <FlowDiagram data={data} />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-6">
          <ReservePanel data={data} />
          <GovernorPanel data={data} />
        </div>
        <div className="lg:col-span-7 space-y-6">
          <CurveProgress data={data} />
          <InjectionChart history={history} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8"><LedgerTable ledger={ledger || []} /></div>
        <div className="lg:col-span-4"><ConfigPanel config={data.config} /></div>
      </div>
    </div>
  );
}
